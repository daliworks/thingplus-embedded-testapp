var _ = require('lodash'),
    db = require('../lib/db'),
    logger = require('log4js').getLogger('TC:REST');;

var DEVICE_POST_TC_PREFIX = 'tcDevicePost-';
var SENSOR_POST_TC_PREFIX = 'tcSensorPost-';


/**
 * logTestResult - print test result to console
 *
 * @param  {type} result description
 * @param  {type} reason description
 * @return {type}        description
 */
function logTestResult(result, reason) {
  if (result) {
    console.log('\t PASS');
  }
  else {
    console.log('\t FAIL. ' + reason);
  }
}


/**
 * isDevicePostValid - verify deivce post body
 *
 * @param  {object} gatewayItem
 * @param  {object} deviceItem
 * @param  {object} cb
 */
function isDevicePostValid(gatewayItem, deviceItem, cb) {
  var gatewayModel = db.findOne('gatewayModels', gatewayItem.model),
      deviceModels = gatewayModel && gatewayModel.deviceModels;

  var deviceKeys = ['reqId', 'model', 'name'];

  // check keys
  _.forEach(deviceKeys, function (key) {
    if(!deviceItem[key]) {
      logger.error('[isDevicePostValid] missing %s. device item=', key, deviceItem);
      return cb && cb('missing ' + key);
    }
  });

  // check duplicated id
  if (_.includes(gatewayItem.devices, deviceItem.reqId)) {
    logger.error('[isDevicePostValid] duplicated reqId. device item=', deviceItem);
    return cb && cb('duplicated reqId');
  }

  // check model validation
  if (_.findIndex(deviceModels, {'id': deviceItem.model}) === -1) {
    logger.error('[isDevicePostValid] invalid model id. device item=', deviceItem);
    return cb && cb('invalid model');
  }

  return cb && cb();
}


/**
 * isSensorPostValid - verify sensor post body
 *
 * @param  {object} gatewayItem
 * @param  {object} sensorItem
 * @param  {function} cb
 */
function isSensorPostValid(gatewayItem, sensorItem, cb) {
  var sensorDriverInfo;

  var sensorKeys = ['network', 'driverNaem', 'model', 'type', 'category', 'name', 'deviceId'];

  _.forEach(sensorKeys, function (key) {
    if(!sensorItem[key]) {
      logger.error('[isSensorPostValid] missing %s. device item=', key, sensorItem);
      return cb && cb('missing ' + key);
    }
  });


  //TODO FIXME  CHECK SENSORINFO VALIDATION HERE

  // check duplicated id
  if (_.includes(gatewayItem.sensors, sensorItem.reqId)) {
    logger.error('[isSensorPostValid] duplicated reqId. sensor item=', deviceItem);
    return cb && cb('duplicated reqId');
  }

  // check sensorDriver

  return cb && cb();

}

/**
 * TcRest - Rest testcase object
 * @constructor
 */
function TcRest () {
  this.history = [];
  _.map(_.filter(_.keysIn(this), function (key) {
    return _.isFunction(this[key]) && _.startsWith(key, 'tc')}.bind(this)),
  function (tc) {
      this.history[tc] = [];//testcases.push({name: tc, result: {}})
  }.bind(this));
}


/**
 * devicePost - verify device post body
 *
 * @param  {object} tcInstance
 * @param  {object} gatewayItem
 * @param  {object} deviceItem
 * @param  {number} time
 * @param  {function} cb
 */
TcRest.prototype.devicePost = function (tcInstance, gatewayItem, deviceItem, time, cb) {
  var that = tcInstance;

  isDevicePostValid(gatewayItem, deviceItem, function (err) {
    var result = true, reason, tcName;

    tcName = deviceItem.reqId ?
        DEVICE_POST_TC_PREFIX + deviceItem.reqId : DEVICE_POST_TC_PREFIX + 'unknown';

    if (err) {
      result = false;
      reason = err;
    }

    that.historySet(tcName, result, time, reason, deviceItem);

    return cb && cb(err, deviceItem);
  });
};


/**
 * sensorPost - verify sensor post body
 *
 * @param  {object} tcInstance
 * @param  {object} gatewayItem
 * @param  {object} sensorItem
 * @param  {number} time
 * @param  {function} cb
 */
TcRest.prototype.sensorPost = function (tcInstance, gatewayItem, sensorItem, time, cb) {
  var that = tcInstance;

  isSensorPostValid(gatewayItem, sensorItem, function (err) {
    var result = true, reason, tcName;

    tcName = sensorItem.reqId ?
        SENSOR_POST_TC_PREFIX + sensorItem.reqId : SENSOR_POST_TC_PREFIX + 'unknown';

    if (err) {
      result = false;
      reason = err;
    }

    that.historySet(tcName, result, time, reason, sensorItem);

    return cb && cb(err, sensorItem);
  });
};


/**
 * historySet - save testcase result
 *
 * @param  {string} tcName
 * @param  {boolean} result
 * @param  {number} time
 * @param  {string} reason
 * @param  {object} raw
 */
TcRest.prototype.historySet = function (tcName, result, time, reason, raw) {
  var tcHistory;

  if (!time) {
    time = new Date();
  }

  logTestResult(result, reason);

  if (!this.history[tcName]) {
    this.history[tcName] = [];
  }

  tcHistory = {
    result: result,
    reason: reason,
    time: time,
    raw: raw
  };

  this.history[tcName].push(tcHistory);
};


/**
 * historyGet - get testcase results
 *
 * @param  {string} tcName
 * @return {object}
 */
TcRest.prototype.historyGet = function (tcName) {
  //console.log(this.result);
  if (tcName) {
    return this.history[tcName];
  }
  else {
    return this.history;
  }
};

module.exports = TcRest;
