const fs = require('fs');
const detailedDiff = require('deep-object-diff').detailedDiff;
const xmlParserSource = require('xml2js').parseString;
const xmlParserDestination = require('xml2js').parseString;
const util = require('util')

let sourceXmlTree;
let destinationXmlTree;

function xmlDiff (source1, source2) {
  if (source1 && source2) {
    return generateDiffEntity(source1, source2);
  } else {
    console.log('usage: xml-diff SOURCE1 SOURCE2. Sources are mandatory arguments.')
    return false;
  }
}

function generateDiffEntity (sourceFilename, destinationFilename) {
	let changes = {};
	const entityName = sourceFilename.split('/').pop().split('.xml')[0];
  let sourceFile;
  if(!fs.existsSync(sourceFilename)) {
    sourceFile = initXmlFile(entityName);
  } else {
  	sourceFile = fs.readFileSync(sourceFilename, 'utf8');
  }

  let destinationFile;
  if(!fs.existsSync(destinationFilename)) {
    destinationFile = initXmlFile(entityName);
  } else {
  	destinationFile = fs.readFileSync(destinationFilename, 'utf8');
  }

  sourceFile = cleanXmlFile(sourceFile);
  destinationFile = cleanXmlFile(destinationFile);

  try {
	  xmlParserSource(sourceFile, function (err, result) {
	  	sourceXmlTree = result

	  	xmlParserDestination(destinationFile, function (err, destResult) {
	  		destinationXmlTree = destResult;
				changes.header = getDiffHeader();
				changes.parameters = getDiffParams();
				changes.enums = getDiffEnums();

				if(!isXmlChanged()){
					changes = null;
			 	}
			});
		});

		return changes;

	} catch (err) {
		console.log(entityName + ': ' + err.message);
	}

	function isXmlChanged () {
	  if(isObjectChanged(changes.header) || Object.keys(changes.parameters).length || Object.keys(changes.enums).length) {
	  	return true;
	  }
	  return false;
	}

	function isObjectChanged (objectTree) {
    if(Object.keys(objectTree.added).length ||
    	 Object.keys(objectTree.deleted).length ||
    	 Object.keys(objectTree.updated).length) {
    	return true;
    }

    return false;
	}
}

function initXmlFile (entityName) {
	return `<?xml version="1.0" encoding="ISO-8859-1"?><objects><object name="${entityName}"></object></objects>`;
}

function getDiffHeader () {
	const sourceHeaderAttributes = sourceXmlTree.objects.object[0].$;
	const destinationHeaderAttributes = destinationXmlTree.objects.object[0].$;

	let detailDiff = detailedDiff(sourceHeaderAttributes, destinationHeaderAttributes);
	for(let attribute in detailDiff.deleted) {
	  detailDiff.deleted[attribute] = sourceHeaderAttributes[attribute];
	}
	const entityNameSingular = (destinationHeaderAttributes.name) ? destinationHeaderAttributes.name : sourceHeaderAttributes.name;
	const entityNamePlural = (destinationHeaderAttributes.plural) ? destinationHeaderAttributes.plural : sourceHeaderAttributes.plural;
	detailDiff.context = {singular: entityNameSingular, plural: entityNamePlural}
	return detailDiff;
}

function getDiffParams () {
  const sourceParameters = generateParamsTree(sourceXmlTree);
  const destinationParameters = generateParamsTree(destinationXmlTree);

  function generateParamsTree (objectTree) {
  	const generatedParamTree = {
  		keys: {},
  		details: {}
  	};

  	if(objectTree.objects.object[0].param) {
	  	objectTree.objects.object[0].param.forEach((param) => {
	    	if (!param.option) {
					generatedParamTree.keys[param.$.name] = param.$.name;
					generatedParamTree.details[param.$.name] = param;
				}
			});
  	}

  	return generatedParamTree;
  }

	let parameters = detailedDiff(sourceParameters.keys, destinationParameters.keys);
	parameters = getFlatParameterList(parameters);

	function getFlatParameterList (groups) {
		let flatParameterList = {};
		for (let status in groups) {
			const params = groups[status];
			for (let key of Object.keys(params)) {
				flatParameterList[key] = { status: status, state: {} };
			}
		}
		return flatParameterList;
	}

	function isAddedOrUpdatedCmshFalse (parameter) {
		return parameter.state && (
			(parameter.state.added && parameter.state.added.cmsh === 'false') || 
			(parameter.state.updated && parameter.state.updated.cmsh === 'false'));
	}

	function isAddedOrUpdatedVisibleFalse (parameter) {
		return assertVisible(parameter, 'added', 'false') || assertVisible(parameter, 'updated', 'false');
	}

	function assertVisible (parameter, state, value) {
		return parameter.state && parameter.state[state] && parameter.state[state].visible !== undefined && parameter.state[state].visible === value;
	}

	function isParameterHidden (parameter) {
		return isAddedOrUpdatedCmshFalse(parameter) || isAddedOrUpdatedVisibleFalse(parameter);
	}

  for(let paramName in destinationParameters.details) {
  	if(sourceParameters.details[paramName]) { //updated parameter
  	  let parametersDiffs = detailedDiff(sourceParameters.details[paramName].$, destinationParameters.details[paramName].$);

			if(Object.keys(parametersDiffs.added).length ||
  			 Object.keys(parametersDiffs.deleted).length ||
  			 Object.keys(parametersDiffs.updated).length) {
  			if(Object.keys(parametersDiffs.deleted).length) {
  				for(attribute in parametersDiffs.deleted) {
  				  parametersDiffs.deleted[attribute] = sourceParameters.details[paramName].$[attribute];
  				}
				}
				parameters[paramName] = {
					status: 'updated',
					state: parametersDiffs
				};
  		}
  	} else { //added parameter
      parameters[paramName].state = destinationParameters.details[paramName];
		}
		
		const parameterData = parameters[paramName];
		if(parameterData && isParameterHidden(parameterData)) {
			parameterData.status = 'hidden';
		}
		
  }
  for(let paramName in sourceParameters.details) {
  	if(!destinationParameters.details[paramName]) { //deleted parameter
  		parameters[paramName].state = sourceParameters.details[paramName];
  	}
	}

  return parameters;
}

function getDiffEnums () {
  const sourceEnums = generateEnumTree(sourceXmlTree);
  const destinationEnums = generateEnumTree(destinationXmlTree);

  function generateEnumTree (objectTree) {
		const generatedEnumTree = {
	  	keys: {},
	  	details: {}
	  };

	  if(objectTree.objects.object[0].enum) {
		  objectTree.objects.object[0].enum.forEach((enumTree)=>{
				const enumName = enumTree.$.name;
		    generatedEnumTree.keys[enumName] = enumName;
				generatedEnumTree.details[enumName] = enumTree;
		  });
		}
		
		generateImplicitEnumTree(objectTree);

		function generateImplicitEnumTree (source) {
			if(source.objects.object[0].param) {
				source.objects.object[0].param.forEach((paramTree) => {
					/*this type of parameter is also an enum*/
					if (paramTree.option) {
						const paramName = paramTree.$.name;
						generatedEnumTree.keys[paramName] = paramName;
						generatedEnumTree.details[paramName] = paramTree;
					}
				});
			}
		}

	  return generatedEnumTree;
  }

	let enums = detailedDiff(sourceEnums.keys, destinationEnums.keys);
	enums = getFlatEnumList(enums);

	function getFlatEnumList (groups) {
		let flatEnumList = {};
		for (let status in groups) {
			const enums = groups[status];
			for (let key of Object.keys(enums)) {
				flatEnumList[key] = { status: status, state: {} };
			}
		}
		return flatEnumList;
	}

	for(let enumName in destinationEnums.details) {

		const sourceDetails = sourceEnums.details[enumName];
		const destinationDetails = destinationEnums.details[enumName];

		if(sourceDetails) { //updated enum
  	  let enumsDiffs = detailedDiff(sourceDetails, destinationDetails);
			if(Object.keys(enumsDiffs.added).length ||
  			 Object.keys(enumsDiffs.deleted).length ||
  			 Object.keys(enumsDiffs.updated).length) {
				enums[enumName] = {
					status: 'updated',
					state: enumsDiffs
				};
  		}
		} else { //added enum
      enums[enumName].state = destinationDetails;
  	}
	}
  for(let enumName in sourceEnums.details) {
		if(!destinationEnums.details[enumName]) { //deleted enum
  		enums[enumName].state = sourceEnums.details[enumName];
  	}
	}
  return enums;

}

function debugObject (obj) {
	console.log(util.inspect(obj, {showHidden: false, depth: null}));
}

function cleanXmlFile (fileContent) {
	fileContent = removeXmlTag(fileContent, 'publicuserfunctions');
	fileContent = removeXmlTag(fileContent, 'include');
	fileContent = removeXmlTag(fileContent, 'validate');

	return fileContent;
}

function removeXmlTag (source, xmlTag) {
	const REGEX_TAG = new RegExp('<' + xmlTag + '.*>(.|\n)*?<\/' + xmlTag + '>','gm');
	return source.replace(REGEX_TAG, '');
}

module.exports = {
  xmlDiff: xmlDiff
};