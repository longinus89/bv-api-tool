const fs = require('fs');
const path = require('path');
const {xmlDiff} = require('./xml-diff');
const {xmlGenerateTags} = require('./xml-generate-tags');

function xmlDiffEntities(sourceFolder, destinationFolder, verbose = true) {
  const diffData = {};
  const sourceEntities = getEntities(sourceFolder);
  
  let totEntities = sourceEntities.length;
  let counterEntity = 0;

  debug('----------------------------------------');
  sourceEntities.forEach(fileName => {
    const entityName = fileName.split('.xml')[0];
    let status = 'updated';
    if (!fs.existsSync(destinationFolder + fileName)) {
      status = 'deleted';
    }

    var json = xmlDiff(sourceFolder + fileName, destinationFolder + fileName);
    if(json !== null) {
      if (isEntityHidden(json)) {
        status = 'hidden';
      }
      diffData[entityName] = {
        status: status,
        state: json
      }
    }
    counterEntity++;
    printProgress();
  });

  debug('');
  debug('Check updated, deleted and hidden entities completed');

  
  var addedEntities = getAddedEntities(sourceFolder, destinationFolder);
  totEntities = addedEntities.length;
  counterEntity = 0;

  addedEntities.forEach(fileName => {
    const entityName = fileName.split('.xml')[0];
    const sourceFilePath = sourceFolder + fileName;
    const destinationFilePath = destinationFolder + fileName;

    var json = xmlDiff(sourceFilePath, destinationFilePath);
    if(json !== null) {
      let status = 'added';
      if (isEntityHidden(json)) {
        status = 'hidden';
      }
      diffData[entityName] = {
        status: status,
        state: json
      }
    }
    counterEntity++;
    printProgress();

  });

  debug('');
  debug('Check added entities completed');

  const filePath = './src/app/shared/data/entitiesChanges.json';
  let jsonData;
  if (!Object.keys(diffData).length) {
    jsonData = JSON.stringify({});
  } else {
    jsonData = JSON.stringify(diffData, (key, value) => {
      if(value === undefined) {
        return null;
      } else if(Object.keys(value).length === 0) {
        return;
      }
      return value;
    }, 2);
  }

  fs.writeFileSync(filePath, jsonData);
  xmlGenerateTags();
  
  function printProgress () {
    if (verbose) {
      const rate = Math.floor((counterEntity * 100) / totEntities);
      process.stdout.write('Generating json diff: ' + rate + '%\r');
    }
  }
  function debug(text) {
    if (verbose) {
      console.log(text);
    }
  }
}

function isCustomEntity (entityName) {
  return entityName.charAt(0) === '_';
}

function getEntities (folderName) {
  return fs.readdirSync(folderName).filter((fileName) => {
    const extName = path.extname(fileName);
    return extName === '.xml' && fileName !== 'event.xml' && !isCustomEntity(fileName);
  });
}

function getAddedEntities (sourceFolder, destinationFolder) {
  return fs.readdirSync(destinationFolder).filter((fileName) => {
    const extName = path.extname(fileName);
    const entityName = path.basename(fileName, '.xml');
    const sourceFilePath = sourceFolder + fileName;
    let isAdded = !isCustomEntity(entityName) && !fs.existsSync(sourceFilePath);
    
    return extName === '.xml' && fileName !== 'event.xml' && !isCustomEntity(fileName) && isAdded;
  });
}

function isEntityHidden (json) {
  var wcgAdded = json.header['added']['wcg-ignore'];
  var wcgUpdated = json.header['updated']['wcg-ignore'];

  return wcgAdded === '1' || wcgUpdated === '1';
}


module.exports = {
  xmlDiffEntities: xmlDiffEntities
};