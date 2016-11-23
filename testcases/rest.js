var _ = require('lodash'),
    db = require('../lib/db'),
    logger = require('log4js').getLogger('TC:REST');;

var DEVICE_POST_TC_PREFIX = 'tcDevicePost-';
var SENSOR_POST_TC_PREFIX = 'tcSensorPost-';

/**
 * 
 * 
 * @param {any} tcName
 */
function logStartTest(tcName) {
  console.log('[TESTING] ' + tcName);
}

/**
 * 
 * 
 * @param {any} result
 * @param {any} reason
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
 * 
 * 
 * @param {any} deviceItem
 * @param {any} cb
 * @returns
 */
function isDevicePostValid(gatewayItem, deviceItem, cb) {
  var gatewayModel = db.findOne('gatewayModels', gatewayItem.model),
      deviceModels = gatewayModel && gatewayModel.deviceModels;

  var deviceKeys = ['reqId', 'model', 'name'];

  // check keys
  _.forEach(deviceKeys, function (key) {
    if(!deviceItem[key]) {
      logger.error('[isDevicePostValid] missing %s. device item=', key, deviceItem);
      return cb && cb('missing ', key);      
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
 * 
 * 
 * @param {any} sensorInfo
 * @param {any} cb
 * @returns
 */
function isSensorPostValid(gatewayItem, sensorItem, cb) {
  var sensorDriverInfo;

  var sensorKeys = ['network', 'driverNaem', 'model', 'type', 'category', 'name', 'deviceId'];

  _.forEach(sensorKeys, function (key) {
    if(!sensorItem[key]) {
      logger.error('[isSensorPostValid] missing %s. device item=', key, sensorItem);
      return cb && cb('missing ', key);      
    }
  });
  

  //TODO FIXME  CHECK SENSORINFO VALIDATION HERE

  // check duplicated id
  if (_.includes(gatewayItem.sensors, sensorItem.reqId)) {
    logger.error('[isSensorPostValid] duplicated reqId. sensor item=', deviceItem);
    return cb && cb('duplicated reqId');
  }  

  // check sensorDeiver

  return cb && cb();

}

/**
 * 
 * 
 * @param {object} config
 */
function TcRest (config) {
  this.hardwareInfo = config;
  this.errorId = [];
  this.tcGeneration();
  this.history = [];
  _.map(_.filter(_.keysIn(this), function (key) {
    return _.isFunction(this[key]) && _.startsWith(key, 'tc')}.bind(this)),
  function (tc) {
      this.history[tc] = [];//testcases.push({name: tc, result: {}})
  }.bind(this));
}

/**
 * 
 */
TcRest.prototype.tcGeneration = function() {
  var that = this;

  _.forEach(this.hardwareInfo.devices, function (device) {
    that[DEVICE_POST_TC_PREFIX + device.id] = isDevicePostValid;

    _.forEach(device.sensors, function (sensor) {
      that[SENSOR_POST_TC_PREFIX + sensor.id] = isSensorPostValid;
    });
  });
};


/**
 * 
 * 
 * @param {any} tcInstance
 * @param {any} gatewayItem
 * @param {any} deviceItem
 * @param {any} time
 * @param {any} cb
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
 * 
 * 
 * @param {any} tcInstance
 * @param {any} gatewayItem
 * @param {any} sensorItem
 * @param {any} time
 * @param {any} cb
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
 * 
 * 
 * @param {any} tcName
 * @param {any} result
 * @param {any} time
 * @param {any} reason
 * @param {any} raw
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



  // if (result) {
  //   this.history[tcName].push({'result': result, 'time': time});
  // }
  // else {
  //   var history = {'result': result, 'reason': reason, 'time': time};
  //   if (raw) {
  //     if (typeof raw === 'object') {
  //       raw = JSON.stringify(raw);
  //     }
  //     history['raw'] = raw;
  //   }

  //   this.history[tcName].push(history);
  // }
};

/**
 * 
 * 
 * @param {any} tcName
 * @returns
 */
TcRest.prototype.historyGet = function (tcName) {
  //console.log(this.result);
  if (tcName) {
    return this.history[tcName];
  }
  else {

    logger.error('>>>>>> history', this.history);
    return this.history;
  }
};

/**
 * 
 * 
 * @param {any} id
 * @param {any} time
 * @param {any} raw
 */
TcRest.prototype.errorIdSet = function (id, time, raw) {
  console.log('Invalid ID(' + id + ')');
  this.errorId.push({'id': id, 'time': time, 'raw': raw});
};

/**
 * 
 * 
 * @returns
 */
TcRest.prototype.errorIdGet = function () {

  logger.info('[errorIdGet] test');

  return this.errorId;
};

module.exports = TcRest;

