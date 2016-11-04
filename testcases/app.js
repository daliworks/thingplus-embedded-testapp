var _ = require('lodash');
var async = require('async');
var TcMqtt = require('./mqtt.js');

var TOPIC_GW_ID_INDEX = 0;
var TOPIC_SENSOR_ID_INDEX = 2;
var TOPIC_GW_STATUS_INDEX = 1;
var TOPIC_SENSOR_STATUS_PREFIX_INDEX = 1;
var TOPIC_SENSOR_STATUS_INDEX = 3;
var TOPIC_MQTT_STATUS_INDEX = 2;
var TOPIC_RES_INDEX = 1;

function makeStatusJson(id, value, timeout) {
  return {'id': id, 'value': value, 'timeout': timeout};
}

function statusParse(cb, topicString, payloadString, id) {
  var payload = payloadString.split(',');

  var message = {};
  message['status'] = [];
  var statusValue = _.slice(payload, 0, 2);
  if (_.size(statusValue) != 2) {
    return tcError(cb, 'short of status', topicString, payloadString);
  }
  message['status'].push(makeStatusJson(id, statusValue[0], statusValue[1]));
  payload = _.drop(payload, 2);

  async.eachSeries(_.chunk(payload, 3), function (statusValue, done) {
    if (_.size(statusValue) !== 3) {
      return done(true);
    }

    message['status'].push(makeStatusJson(statusValue[0], statusValue[1], statusValue[2]));
    return done();
  },
  function (err) {
    if (err)
      return tcError(cb, 'short of status', topicString, payloadString);

    cb && cb(null, message, 'status');
    return message;
  });
}

function mqttStatusParse(cb, topicString, payloadString) {
  var payload = payloadString.split(',');

  var message = {};
  message['mqttStatus'] = payloadString.toString();
  return cb && cb(null, message);
}

function makeValueJson(id, values) {
  /* values = [time, value, time , value] */

  var value = [];
  _.map(_.chunk(values, 2), function (v) {
    if (!v[0] || !v[1]) {
      throw new Error('Missing values');
    }

    value.push({"v": v[1], "t": v[0]});
  });

  return {"id": id, "value": value};
}

function sensorValueParse(cb, topicString, payloadString, id) {
  var payloadTemp = payloadString;
  if (!_.startsWith(payloadTemp, '[') && !_.endsWith(payloadTemp, ']')) {
    payloadTemp = '[' + payloadTemp + ']';
  }

  try {
    payload = JSON.parse(payloadTemp);
  }
  catch (e) {
    return tcError(cb, 'value format error', topicString, payloadString)
  }

  var message = {};
  message.sensorValue = [];

  try {
    message.sensorValue.push(makeValueJson(id, payload));
  }
  catch (e) {
    return tcError(cb, 'short of value', topicString, payloadString)
  }

  return cb && cb(null, message);
}

function sensorsValueParse(cb, topicString, payloadString) {
  try {
    var payload = JSON.parse(payloadString)
  } catch (e) {
    return tcError(cb, 'value format error', topicString, payloadString)
  }

  var message = {};
  message.sensorValue = [];

  _.forEach(payload, function (values, id) {
    try {
      message.sensorValue.push(makeValueJson(id, values));
    }
    catch (e) {
      return tcError(cb, 'short of value', topicString, payloadString)
    }
  });

  return cb && cb(null, message);
}

function responseParse(cb, topicString, payloadString) {
  try {
    var message = JSON.parse(payloadString);
  }
  catch (e) {
    return tcError(cb, 'err payload parsing', topicString, payloadString);
  }

  return cb && cb(null, message);
}

function Testcases(config) {
  this.hardwareInfo = config;
  this.mqtt = new TcMqtt(config);
  this.errorMqttMessage = [];
  this.mqttMessage = [];
}

function tcError(cb, reason, topic, payload) {
  if (!cb)
    return;

  var err = new Error();
  err.message = reason;

  return cb(err, topic, payload);
}

Testcases.prototype.mqttParse = function (topicString, payload, time, cb) {
  var that = this;

  this.mqttMessage.push({'topic': topicString, 'payload': payload});

  /* start of internal function */
  function _postParsingCb(err, topic, payload) {
    if (err) {
      that.setErrorMqttMessage(topic, payload, time, err.message);
    }

    return cb(err, topic, payload);
  }
  /* end of internal function */

  if (!topicString) {
    return tcError(_postParsingCb, 'empty topic', topicString, payload);
  }

  if (!_.startsWith(topicString, 'v/a/g/')) {
      return tcError(_postParsingCb, 'prefix error', topicString, payload);
  }

  topic = topicString.slice('v/a/g/'.length).split('/');

  if (_.last(topic) === 'status') {
     var statusIndex = _.indexOf(topic, 'status'); 
     if (statusIndex === TOPIC_GW_STATUS_INDEX) {
       return statusParse(_postParsingCb, topicString, payload, topic[TOPIC_GW_ID_INDEX]);
     }
     else if (statusIndex === TOPIC_SENSOR_STATUS_INDEX) {
       if (topic[TOPIC_SENSOR_STATUS_PREFIX_INDEX] !== 's') {
         return tcError(_postParsingCb, 'sensor prefix error', topicString, payload);
       }

       return statusParse(_postParsingCb, topicString, payload, topic[statusIndex -1]);
     }
     else if (statusIndex === TOPIC_MQTT_STATUS_INDEX) {
       return mqttStatusParse(_postParsingCb, topicString, payload);
     }
     else {
       return tcError(_postParsingCb, 'status topic error', topicString, payload);
     }
  }
  else if (_.last(topic) === 'res' && _.indexOf(topic, 'res') === TOPIC_RES_INDEX) {
    return responseParse(_postParsingCb, topicString, payload);
  }
  else if (_.size(topic) === 3 && topic[TOPIC_SENSOR_STATUS_PREFIX_INDEX] === 's') {
    return sensorValueParse(_postParsingCb, topicString, payload, topic[TOPIC_SENSOR_ID_INDEX]);
  }
  else if (_.size(topic) === 1) {
    return sensorsValueParse(_postParsingCb, topicString, payload);
  }
  else
    return tcError(_postParsingCb, 'unknown topic', topicString, payload);
};

Testcases.prototype.getMqttMessage = function () {
  return this.mqttMessage;
}

Testcases.prototype.setErrorMqttMessage = function (topic, payload, time, reason) {
  this.errorMqttMessage.push( {
    'topic': topic,
    'payload': payload,
    'time': time,
    'reason': reason
  });
};

Testcases.prototype.getErrorMqttMessage = function () {
  return this.errorMqttMessage;
}

module.exports = Testcases;

