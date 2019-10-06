const fs = require('fs');

let fileDiffs = {};
let entities = {};

function xmlGenerateTags () {
  fileDiffs = JSON.parse(fs.readFileSync('./src/app/shared/data/entitiesChanges.json', 'utf8'));
  for(entityName in fileDiffs) {
    entities[entityName] = entities[entityName] || { tags: [], parameters: {}};
    const status = fileDiffs[entityName].status;
    //TO DO: check attributes in header like read-only
  	if(status === 'added') {
      entities[entityName].tags.push('added_entity');
    } else if (status === 'deleted') {
      entities[entityName].tags.push('deleted_entity');
    } else {
      entities[entityName].tags.push('changed_entity');
    }
    xmlGenerateParametersTags(entityName);
  }
  generateTagsFile();
}

function xmlGenerateParametersTags (entityName) {

  const entity = fileDiffs[entityName];
  const parameters = {
    added: {},
    deleted: {},
    updated: {},
    hidden: {}
  };
  for (let paramName in entity.state.parameters) {
    const param = entity.state.parameters[paramName];
    parameters[param.status][paramName] = param;
  }

  for(parameterName in parameters.added) {
    initParameter(entityName, parameterName);
    if(isParameterObject(parameters.added[parameterName])) {
      entities[entityName].parameters[parameterName].push('added_parameter_object');
    } else {
      entities[entityName].parameters[parameterName].push('added_parameter');
    }
  }

  const deletedParameters = parameters.deleted;
  for(parameterName in deletedParameters) {
    initParameter(entityName, parameterName);
    if(isParameterObject(deletedParameters[parameterName])) {
      entities[entityName].parameters[parameterName].push('deleted_parameter_object');
    } else {
      entities[entityName].parameters[parameterName].push('deleted_parameter');
    }
  }

  const updatedOrHiddenParameters = {...parameters.updated, ...parameters.hidden};
  for(parameterName in updatedOrHiddenParameters) {
    let tags = [];
    initParameter(entityName, parameterName);
    const parameter = updatedOrHiddenParameters[parameterName];
    if (isRemovedCmshFalse(parameter)) {
      tags.push('removed_cmsh_false');
    }
    if (isAddedOrUpdatedCmshFalse(parameter)) {
      tags.push('added_cmsh_false');
    }
    if (isChangedHuman(parameter)) {
      tags.push('changed_human');
    }
    if (isChangedDescription(parameter)) {
      tags.push('changed_description');
    }
    if (assertVisible(parameter, 'added', 'true')) {
      tags.push('added_visible_true');
    } else if (assertVisible(parameter, 'added', 'false')) {
      tags.push('added_visible_false');
    } else if (assertVisible(parameter, 'deleted', 'true')) {
      tags.push('deleted_visible_true');
    } else if (assertVisible(parameter, 'deleted', 'false')) {
      tags.push('deleted_visible_false');
    }  else if (assertVisible(parameter, 'updated', 'true')) {
      tags.push('changed_visible_true');
    } else if (assertVisible(parameter, 'updated', 'false')) {
      tags.push('changed_visible_false');
    }
    entities[entityName].parameters[parameterName] = entities[entityName].parameters[parameterName].concat(tags);
  }
}

function initParameter(entityName, parameterName) {
  entities[entityName].parameters[parameterName] = entities[entityName].parameters[parameterName] || [];
}

function isParameterObject (parameter) {
  return parameter.state.$.type.indexOf('$') !== -1
}

function generateTagsFile () {
	const filePath = './src/app/shared/data/tags.json';
  fs.writeFileSync(filePath, JSON.stringify(entities, null, 2));
}

function isRemovedCmshFalse (parameter) {
  return parameter.state && parameter.state.deleted && parameter.state.deleted.cmsh === 'false';
}

function isAddedOrUpdatedCmshFalse (parameter) {
  return parameter.state && (
    (parameter.state.added && parameter.state.added.cmsh === 'false') || 
    (parameter.state.updated && parameter.state.updated.cmsh === 'false'));
}

function isChangedHuman (parameter) {
  return parameter.state && parameter.state.updated && parameter.state.updated.human !== undefined;
}

function isChangedDescription (parameter) {
  return parameter.state && parameter.state.updated && parameter.state.updated.description !== undefined;
}

function assertVisible (parameter, state, value) {
  return parameter.state && parameter.state[state] && parameter.state[state].visible !== undefined && parameter.state[state].visible === value;
}

module.exports = {
  xmlGenerateTags: xmlGenerateTags
};
