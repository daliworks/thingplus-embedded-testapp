var _ = require('lodash');
var async = require('async');

var TC_SENSOR_VALUE_PREFIX = 'tcValue-'
var TC_STATUS_PREFIX = 'tcStatus-'

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
 * @param {any} hardwareInfo
 * @param {any} id
 * @returns
 */
function isValidId(hardwareInfo, id) {
  if (hardwareInfo.gatewayId === id)
    return true;

  var match = false;
  _.forEach(hardwareInfo.sensors, function (sensor) {
    if (sensor.id === id) {
      match = true;
    }
  });

  return match;
}

/**
 * 
 * 
 * @param {any} hardwareInfo
 * @returns
 */
function sensorIdsInit(hardwareInfo) {
  var sensorIds = [];

  _.forEach(hardwareInfo.devices, function (device) {
    _.forEach(device.sensors, function (sensor) {
      if (sensor.category === 'sensor') {
        sensorIds.push(sensor.id);
      }
    });
  });

  return sensorIds;
}

/**
 * 
 * 
 * @param {any} hardwareInfo
 * @returns
 */
function statusIdsInit(hardwareInfo) {
  var statusIds = [];

  _.forEach(hardwareInfo.devices, function (device) {
    _.forEach(device.sensors, function (sensor) {
        statusIds.push(sensor.id);
    });
  });

  statusIds.push(hardwareInfo.gatewayId);

  return statusIds;
}

/**
 * 
 * 
 * @param {any} s
 * @param {any} cb
 * @returns
 */
function isStatusValid(s, cb) {
  if (!_.includes(['on', 'off'], s.value.toLowerCase())) {
    return cb(false, 'STATUS ERROR(' + s.value + ')');
  }

  // STATUS는 미래시간일 경우 FALSE
  // 과거 시간도 X 시간 이전이면 FALSE
  if (s.timeout && isNaN(s.timeout)) {
    return cb(false, 'TIMEOUT ERROR(' + s.timeout + ')');
  }

  cb(true);
}

/**
 * 
 * 
 * @param {any} values
 * @param {any} validValuecb
 */
function isValueValid (values, validValuecb) {
  async.each(values, function (value, _asyncDone) {
    if (value.t && isNaN(value.t)) {
      return _asyncDone('TIME ERROR(' + value.t + ')');
    }

    //TODO FIXME VALUE CHECK HERE AFTER SENSERTYPE AVAIL
    _asyncDone();
  },
  function (err) {
    validValuecb(!err, err);
  });
}

/**
 * 
 * 
 * @param {any} config
 */
function TcMqtt (config) {
  this.hardwareInfo = config;

  this.sensorValueIds = sensorIdsInit(this.hardwareInfo);
  this.statusIds = statusIdsInit(this.hardwareInfo);
  this.generation();

  this.errorId = [];
  this.history = {};
  _.map(_.filter(_.keysIn(this), function (key) {
    return _.isFunction(this[key]) && _.startsWith(key, 'tc')}.bind(this)),
  function (tc) {
      this.history[tc] = [];//testcases.push({name: tc, result: {}})
  }.bind(this));
}
/*
   history = { 
   { "tcStatus-012345012345": []},
   { "tcStatus-012345012345-0": []},
   { "tcApikey": []},
   { "tcGatewayId": [
      {"result": true, "time": ...},
      {"result": false, "reason": ..., "time"}
    ]}
   },
*/

/**
 * 
 */
TcMqtt.prototype.generation = function () {
  var that = this;

  _.forEach(this.sensorValueIds, function (id) {
     that[TC_SENSOR_VALUE_PREFIX + id] = isValueValid;
  });

  _.forEach(this.statusIds, function (id) {
     that[TC_STATUS_PREFIX + id] = isStatusValid;
  });
}

/**
 * 
 * 
 * @param {any} expect
 * @param {any} actual
 * @param {any} time
 * @param {any} cb
 * @returns
 */
TcMqtt.prototype.equal = function (expect, actual, time, cb) {
  var result = _.isEqual(expect, actual);
  var reason;

  if (!result) {
    reason = 'expect:'+ expect +', actual:' + actual;
  }

  return cb && cb (result, reason);


  if (result) {
    this.historySet(tcName, result, time);
  }
  else {
    this.historySet(tcName, result, time, 'expect:'+ expect +', actual:' + actual);
  }

  return cb && cb(null, result, actual);
}

/**
 * 
 * 
 * @param {any} statuses
 * @param {any} time
 * @param {any} raw
 * @param {any} cb
 */
TcMqtt.prototype.statuses = function (statuses, time, raw, cb) {
  var that = this;

  async.each(statuses, function (status, asyncDone) {
    var tcName;

    if (!_.includes(that.statusIds, status.id)) {

      that.errorIdSet(status.id, time, raw);
      return asyncDone();
    }

    tcName = TC_STATUS_PREFIX + status.id;
    logStartTest(tcName);
    that[tcName](status, function (result, reason) {
        that.historySet(tcName, result, time, reason, raw);
        asyncDone();
      });
    },
    function (err) {
      cb && cb();
  });
};

/**
 * 
 * 
 * @param {any} values
 * @param {any} time
 * @param {any} raw
 * @param {any} cb
 */
TcMqtt.prototype.sensorValues = function (values, time, raw, cb) {
  var that = this;

  async.each(values, function (value, asyncDone) {
    var tcName;

    if (!_.includes(that.sensorValueIds, value.id)) {
      that.errorIdSet(value.id, time, raw);
      return asyncDone();
    }

    tcName = TC_SENSOR_VALUE_PREFIX + value.id;
    logStartTest(tcName);
    if (!that[tcName] && typeof that[tcName] !== 'function') {
      return asyncDone();
    }

    that[tcName](value, function (result, reason) {
        if (result) {
          that.historySet(tcName, result, time, raw);
        }
        else {
          that.historySet(tcName, result, time, reason, raw);
        }

        asyncDone();
      });
    },
    function (err) {
      cb && cb();
  });
}

/**
 * 
 * 
 * @param {any} gatewayId
 * @param {any} time
 * @param {any} cb
 */
TcMqtt.prototype.tcGatewayId = function (gatewayId, time, cb) {
  logStartTest('tcGatewayId');

  this.equal(this.hardwareInfo.gatewayId, gatewayId, time, function (result, reason){
    this.historySet('tcGatewayId', result, time, reason);
    cb && cb();
  }.bind(this));
};

/**
 * 
 * 
 * @param {any} apikey
 * @param {any} time
 * @param {any} cb
 */
TcMqtt.prototype.tcApikey = function (apikey, time, cb) {
  logStartTest('tcApikey');

  this.equal(this.hardwareInfo.apikey, apikey, time, function (result, reason){
    this.historySet('tcApikey', result, time, reason);
    cb && cb();
  }.bind(this));
};

/**
 * 
 * 
 * @param {any} cleanSession
 * @param {any} time
 * @param {any} cb
 */
TcMqtt.prototype.tcCleanSession = function (cleanSession, time, cb) {
  logStartTest('tcCleanSession');

  this.equal(true, cleanSession, time, function (result, reason){
    this.historySet('tcCleanSession', result, time, reason);
    cb && cb();
  }.bind(this));
};

/**
 * 
 * 
 * @param {any} willMessage
 * @param {any} time
 * @param {any} cb
 */
TcMqtt.prototype.tcWillMessage = function (willMessage, time, cb) {
  logStartTest('tcWillMessage');

  var expectWill = {
    'topic': 'v/a/g/' + this.hardwareInfo.gatewayId + '/mqtt/status',
    'payload': new Buffer('err'),
    'qos': 1,
    'retain': true
  };

  this.equal(expectWill, willMessage, time, function (result, reason){
    this.historySet('tcWillMessage', result, time, reason);
    cb && cb();
  }.bind(this));
};

/**
 * 
 * 
 * @param {any} keepalive
 * @param {any} time
 * @param {any} cb
 */
TcMqtt.prototype.tcKeepalive = function (keepalive, time, cb) {
  logStartTest('tcKeepalive');

  var MAX_KEEPALIVE = 60 * 10;
  var expectation = this.hardwareInfo.reportInterval > MAX_KEEPALIVE ? 
    MAX_KEEPALIVE : this.hardwareInfo.reportInterval * 2;

  this.equal(expectation, keepalive, time, function (result, reason){
    this.historySet('tcKeepalive', result, time, reason);
    cb && cb();
  }.bind(this));
};

/**
 * 
 * 
 * @param {any} tcName
 * @returns
 */
TcMqtt.prototype.historyGet = function (tcName) {
  //console.log(this.result);
  if (tcName) {
    return this.history[tcName];
  }
  else {
    return this.history;
  }
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
TcMqtt.prototype.historySet = function (tcName, result, time, reason, raw) {
  if (!time) {
    time = new Date();
  }

  logTestResult(result, reason);

  if (result) {
    this.history[tcName].push({'result': result, 'time':time});
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

/**
 * 
 * 
 * @param {any} id
 * @param {any} time
 * @param {any} raw
 */
TcMqtt.prototype.errorIdSet = function (id, time, raw) {
  this.errorId.push({'id': id, 'time': time, 'raw': raw});
}

/**
 * 
 * 
 * @returns
 */
TcMqtt.prototype.errorIdGet = function () {
  return this.errorId;
}

module.exports = TcMqtt;

