var _ = require('lodash');
var async = require('async');
var callerId = require('caller-id');
var fs = require('fs');

var TC_SENSOR_VALUE_PREFIX = 'tcValue-'
var TC_STATUS_PREFIX = 'tcStatus-'

function isContain (expect, actual) {
  var match = false;
  actual = actual.toLowerCase();

  _.forEach(expect, function (exp) {
    if (exp.toLowerCase() === actual) {
      match = true;
    }
  });

  return match;
};

function isNumerical(numericalString) {
  return numericalString.match(/^\d+$/g)
}

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

function sensorIdsInit(hardwareInfo) {
  var sensorIds = [];
  _.forEach(hardwareInfo.sensors, function (sensor) {
    sensorIds.push(sensor.id);
  });
  return sensorIds;
}

function statusIdsInit(hardwareInfo) {
  var statusIds = [];
  statusIds.push(hardwareInfo.gatewayId);
  statusIds.push(sensorIdsInit(hardwareInfo));

  return _.flatten(statusIds);
}

function isStatusValid(s, cb) {
  if (!isContain(['on', 'off'], s.value)) {
    return cb(false, 'VALUE ERROR(' + s.value + ')');
  }

  if (!isNumerical(s.timeout)) {
    return cb(false, 'TIMEOUT ERROR(' + s.timeout + ')');
  }

  cb(true);
}

function isValueValid (sensorValue, validSensorValueCb) {
  function __isValidValue(values, validValuecb) {
    async.each(values, function (value, _asyncDone) {
      if (!isNumerical(value.t)) {
        return _asyncDone('TIME ERROR(' + value.t + ')');
      }

      _asyncDone();
    },
    function (err) {
      validValuecb(!err, err);
    });
  } 

  __isValidValue(sensorValue.value, validSensorValueCb);
}

function TcMqtt (configFile) {
  try {
    this.hardwareInfo = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  }
  catch (e) {
    throw e;
  }

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
    {"result": false, "reason": ..., "time"}]}
   },
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

TcMqtt.prototype.equal = function (expect, actual, time, cb) {
  var tcName = callerId.getData().methodName;
  var result = expect === actual;

  if (result) {
    this.historySet(tcName, result, time);
  }
  else {
    this.historySet(tcName, result, time, 'expect:'+ expect +', actual:' + actual);
  }

  return cb && cb(null, result, actual);
}

TcMqtt.prototype.statuses = function (statuses, time, raw, cb) {
  var r = true;
  var that = this;

  async.each(statuses, function (status, asyncDone) {
    if (!isContain(that.statusIds, status.id)) {
      r = false;

      that.errorIdSet(status.id, time, raw);
      return asyncDone();
    }

    var tcName = TC_STATUS_PREFIX + status.id;
    that[tcName](status, function (result, reason) {
        if (result) {
          that.historySet(tcName, result, time, raw);
        }
        else {
          r = false;
          that.historySet(tcName, result, time, reason, raw);
        }

        asyncDone();
      });
    },
    function (err) {
      cb(r);
  });
};

TcMqtt.prototype.sensorValues = function (values, time, raw, cb) {
  var r = true;
  var that = this;

  async.each(values, function (value, asyncDone) {
    if (!isContain(that.sensorValueIds, value.id)) {
      r = false;

      that.errorIdSet(value.id, time, raw);
      return asyncDone();
    }

    var tcName = TC_SENSOR_VALUE_PREFIX + value.id;
    that[tcName](value, function (result, reason) {
        if (result) {
          that.historySet(tcName, result, time, raw);
        }
        else {
          r = false;
          that.historySet(tcName, result, time, reason, raw);
        }

        asyncDone();
      });
    },
    function (err) {
      cb(r);
  });
}

TcMqtt.prototype.tcGatewayId = function (gatewayId, time, cb) {
  this.equal(this.hardwareInfo.gatewayId, gatewayId, time, cb);
};

TcMqtt.prototype.tcApikey = function (apikey, time, cb) {
  this.equal(this.hardwareInfo.apikey, apikey, time, cb);
};

TcMqtt.prototype.tcCleanSession = function (cleanSession, time, cb) {
  this.equal(true, cleanSession, time, cb);
};

TcMqtt.prototype.tcWillMessage = function (willMessage, time, cb) {
  var expectWill = {
    'topic': 'v/a/g/' + this.hardwareInfo.gatewayId + '/mqtt/status',
    'payload': 'err',
    'retain': true
  };

  this.equal(expectWill, willMessage, time, cb);
};

TcMqtt.prototype.tcKeepalive = function (keepalive, time, cb) {
  var MAX_KEEPALIVE = 60 * 10;
  var expectation = this.hardwareInfo.reportInterval > MAX_KEEPALIVE ? 
    MAX_KEEPALIVE : this.hardwareInfo.reportInterval;

  return this.equal(expectation, keepalive, time, cb);
};

TcMqtt.prototype.historyGet = function (tcName) {
  //console.log(this.result);
  if (tcName) {
    return this.history[tcName];
  }
  else {
    return this.history;
  }
};

TcMqtt.prototype.historySet = function (tcName, result, time, reason, raw) {
  if (!time) {
    time = new Date();
  }

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

TcMqtt.prototype.errorIdSet = function (id, time, raw) {
  this.errorId.push({'id': id, 'time': time, 'raw': raw});
}

TcMqtt.prototype.errorIdGet = function () {
  return this.errorId;
}

module.exports = TcMqtt;

