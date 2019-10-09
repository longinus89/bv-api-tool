const Handlebars = require('handlebars');
const dirname = require('path').dirname;
const configs = require('./config.js');
Handlebars.registerHelper('toLowerCase', (word) => {
  return word.toLowerCase();
});

Handlebars.registerHelper('capitalize', (word) => {
  return word.charAt(0).toUpperCase() + word.slice(1)
});

const fs = require('fs');
const xmlParserSource = require('xml2js').parseString;
const util = require('util');

function runGenerateApi() {
  const cmdFolder = process.argv[2];

  if (!cmdFolder) {
    console.log('usage: generate-api CMD_FOLDER. CMD folder relative path is required.');
    console.log('e.g. node ./scripts/generate-api.js ../cmdaemon/src/autogen/services/');
    return false;
  }

  generateApi(cmdFolder);
}

function generateApi (folder) {
  const files = fs.readdirSync(folder);
  if (!files) {
    console.error("Could not list the directory.", err);
    process.exit(1);
  }
  const servicesNames = files.reduce((aggr, filename) => {
    const filePath = `${folder}/${filename}`;
    if (fs.lstatSync(filePath).isFile()) {
      const sourceData = fs.readFileSync(filePath, 'utf8');
      const promise = generateController(sourceData)
      return [
        ...aggr,
        promise
      ];
    }
    return aggr;
  }, []);

  Promise.all(servicesNames).then(function(names) {
    generateModule(names);
  }).catch(err => console.log(err));
}

function generateController(sourceData) {
  return new Promise((resolve, reject) => {
    try {
      xmlParserSource(sourceData, function (err, result) {
        const parsedData = result.cmservices.cmservice[0];
        const serviceName = parsedData.$.name;
        const methods = getFunctions(parsedData);
        
        Object.entries(methods).forEach(entry => generateTypeFile(serviceName, entry[0], entry[1]));

        var compiledTemplate = Handlebars.compile(configs.controllerTemplate)({
          serviceName,
          methods: Object.keys(methods)
        });
        createFile(`${configs.outputDir}/${serviceName.toLowerCase()}.controller.ts`, compiledTemplate);
        resolve(serviceName);
      });
    } catch (err) {
      reject(err.message);
    }

  });
}

function generateModule (controllerNames) {
  var compiledTemplate = Handlebars.compile(configs.featuresModuleTemplate)({
    controllerNames
  });
  createFile(`${configs.outputDir}/features.module.ts`, compiledTemplate);
}

function getFunctions (parsedData) {
  return parsedData.function.reduce((aggr, entryFunction) => {
    const nodeonly = entryFunction.$.nodeonly;
    const forward = entryFunction.$.forward;
    if (nodeonly && ['true', '1'].includes(nodeonly)) {
      return aggr;
    }
    let functionName = entryFunction.$.name;
    let inputs = entryFunction.in || [];
    
    if (forward) {
      functionName = `p${functionName}`;
      inputs = [
        ...inputs,
        ...[ { '$': { type: '@V', name: 'uniqueKeys' } }],
      ]
    }
 
    return {
      ...aggr,
      [functionName]: {
        inputs,
        outputs: entryFunction.out || []
      }
    };
  }, []);
}

function generateTypeFile (serviceName, fileName, method) {
  const inputs = method.inputs.map(entry => (
    {
      name: entry.$.name,
      type: typeMapper(entry['$'].type)
    }
  ));
  var compiledTemplate = Handlebars.compile(configs.typeFileTemplate)({
    inputs,
    fileName
  });
  createFile(`${configs.outputDir}/models/${serviceName.toLowerCase()}/${fileName}.class.ts`, compiledTemplate);
}

function typeMapper (type) {
  return (type === 'V' || type === 'I' || type === 'U' || type === 'L')
    ? 'number'
    : (type === 'B')
    ? 'boolean'
    : (type === 'S')
    ? 'string'
    : (type === '@V' || type === '@I' || type === '@U' || type === '@L')
    ? 'number[]'
    : (type === '@B')
    ? 'boolean[]'
    : (type === '@S')
    ? 'string[]'
    : 'any';
}

        /*     { '$':
        { name: 'removeGroup',
          call: 'req->getCMDaemon()->getUserManager()->removeGroup(#);',
          audit: 'true' },
       token: [ { '$': { name: 'UPDATE_GROUP_TOKEN' } } ],
       in:
        [ { '$': { type: 'V', name: 'key' } },
          { '$': { type: 'I', name: 'force', default: '0' } } ],
       out:
        [ { '$': { type: 'B', name: 'success' } },
          { '$': { type: 'V', name: 'taskId' } },
          { '$': { type: '$$WillChange', name: 'changes' } } ] },
*/

function createFile(filePath, data) {

  const dir = dirname(filePath);
  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, {recursive: true});
  }

  fs.writeFile(filePath, data,  function(err) {
      if (err) {
        return console.error(err);
      }
  });
}

function debugObject (obj) {
	console.log(util.inspect(obj, {showHidden: false, depth: null}));
}

runGenerateApi();

