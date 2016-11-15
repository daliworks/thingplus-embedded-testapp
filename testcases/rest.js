var _ = require('lodash');

var DEVICE_POST_TC_PREFIX = 'tcDevicePost-';
var SENSOR_POST_TC_PREFIX = 'tcSensorPost-';

function logStartTest(tcName) {
  console.log('[TESTING] ' + tcName);
}

function logTestResult(result, reason) {
  if (result) {
    console.log('\t PASS');
  }
  else {
    console.log('\t FAIL. ' + reason);
  }
}

function isDevicePostValid(deviceInfo, cb) {
  if (!deviceInfo.name) {
    return cb && cb(false, 'missing name');
  }

  if (!deviceInfo.model) {
    return cb && cb(false, 'missing model');
  }

  //TODO FIXME  CHECK SENSORINFO VALIDATION HERE

  return cb && cb(true);
}

function isSensorPostValid(sensorInfo, cb) {
  if (!sensorInfo.network) {
    return cb && cb(false, 'missing network');
  }

  if (!sensorInfo.driverName) {
    return cb && cb(false, 'missing driverName');
  }

  if (!sensorInfo.model) {
    return cb && cb(false, 'missing model');
  }

  if (!sensorInfo.type) {
    return cb && cb(false, 'missing type');
  }

  if (!sensorInfo.category) {
    return cb && cb(false, 'missing category');
  }

  if (!sensorInfo.name) {
    return cb && cb(false, 'missing name');
  }

  if (!sensorInfo.owner) {
    return cb && cb(false, 'missing owner');
  }

  if (!sensorInfo.ctime) {
    return cb && cb(false, 'missing ctime');
  }

  if (!sensorInfo.deviceId) {
    return cb && cb(false, 'missing deviceId');
  }

  //TODO FIXME  CHECK SENSORINFO VALIDATION HERE

  return cb && cb(true);

}

function TcRest (config) {
  this.hardwareInfo = config
  this.errorId = [];
  this.tcGeneration();
  this.history = [];
  _.map(_.filter(_.keysIn(this), function (key) {
    return _.isFunction(this[key]) && _.startsWith(key, 'tc')}.bind(this)),
  function (tc) {
      this.history[tc] = [];//testcases.push({name: tc, result: {}})
  }.bind(this));
}

TcRest.prototype.tcGeneration = function() {
  var that = this;

  _.forEach(this.hardwareInfo.devices, function (device) {
    that[DEVICE_POST_TC_PREFIX + device.id] = isDevicePostValid;

    _.forEach(device.sensors, function (sensor) {
      that[SENSOR_POST_TC_PREFIX + sensor.id] = isSensorPostValid;
    });
  });
}

TcRest.prototype.devicePost = function (deviceInfo, time, cb) {
  var that = this;

  if (!deviceInfo.reqId) {
    that.errorIdSet(deviceInfo.reqId, time, deviceInfo);
    return cb && cb();
  }

  var tcName = DEVICE_POST_TC_PREFIX + deviceInfo.reqId;
  if (!this[tcName] && typeof this[tcName] !== 'function') {
    that.errorIdSet(deviceInfo.reqId, time, deviceInfo);
    return cb && cb();
  }

  logStartTest(tcName);

  this[tcName](deviceInfo, function (result, reason) {
    if (result) {
      that.historySet(tcName, result, time, deviceInfo);
    }
    else {
      that.historySet(tcName, result, time, reason, deviceInfo);
    }

    return cb && cb();
  });
};

TcRest.prototype.sensorPost = function (sensorInfo, time, cb) {
  var that = this;

  if (!sensorInfo.reqId) {
    that.errorIdSet(sensorInfo.reqId, time, sensorInfo);

    return cb && cb();
  }

  var tcName = SENSOR_POST_TC_PREFIX + sensorInfo.reqId;

  if (!this[tcName] && typeof this[tcName] !== 'function') {
    that.errorIdSet(sensorInfo.reqId, time, sensorInfo);

    return cb && cb();
  }

  logStartTest(tcName);

  this[tcName](sensorInfo, function (result, reason) {
    if (result) {
      that.historySet(tcName, result, time, sensorInfo);
    }
    else {
      that.historySet(tcName, result, time, reason, sensorInfo);
    }

    return cb && cb();
  });
};

TcRest.prototype.historySet = function (tcName, result, time, reason, raw) {
  if (!time) {
    time = new Date();
  }

  logTestResult(result, reason);

  if (result) {
    this.history[tcName].push({'result': result, 'time': time});
  }
  else {
    var history = {'result': result, 'reason': reason, 'time': time};
    if (raw) {
      if (typeof raw === 'object') {
        raw = JSON.stringify(raw);
      }
      history['raw'] = raw;
    }

    this.history[tcName].push(history);
  }
};

TcRest.prototype.historyGet = function (tcName) {
  //console.log(this.result);
  if (tcName) {
    return this.history[tcName];
  }
  else {
    return this.history;
  }
};

TcRest.prototype.errorIdSet = function (id, time, raw) {
  console.log('Invalid ID(' + id + ')');
  this.errorId.push({'id': id, 'time': time, 'raw': raw});
}

TcRest.prototype.errorIdGet = function () {
  return this.errorId;
}

module.exports = TcRest;

