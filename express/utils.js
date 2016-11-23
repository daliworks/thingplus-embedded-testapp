#!/usr/bin/env node
'use strict';

var _ = require('lodash'),
    logger = require('log4js').getLogger('HTTP');

/**
 * to apply fields in data
 * 
 * @param {object or array} data
 * @param {string or array} fields
 * @returns
 */
function queryFields(data, fields) {
  var rtn, defaultFields = ['id'];

  if (_.isString(fields)) {
    fields = [fields];
  }

  if (!_.isArray(fields) && _.isEmpty(fields)) {
    return data;
  }

  logger.info('[utils/queryFields] fields=', fields);

  fields = _.union(fields, defaultFields);

  if (_.isArray(data)) {
    rtn = _.reduce(data, function (result, item) {
      result.push(_.pick(item, fields));
      return result;
    }, []);
  } else {
    rtn = _.pick(data, fields);
  }

  return rtn;
}

/**
 * to apply filter in data
 * 
 * @param {array} data
 * @param {object} filter
 * @returns
 */
function queryFilter(data, filter) {
  var rtn;

  if (!_.isObject(filter)) {
    return data;
  }

  logger.info('[utils/queryFilter] filter=', filter);

  rtn = _.reduce(data, function (result, item) {
    if (_.isMatch(item, filter)) {
      result.push(item);
    }

    return result;
  }, []);

  return rtn;  
}

/**
 * process query(filter or fields) for data
 * 
 * @param {object or array} data
 * @param {object} options
 * @returns data
 */
module.exports.processQuery = function (data, options) {
  var filter = options.filter,
      fields = options.fields,
      rtnData = data;

  if (filter && _.isArray(rtnData)) {
    rtnData = queryFilter(rtnData, filter);
  }

  if (fields) {
    rtnData = queryFields(rtnData, fields);
  }

  return rtnData;
};