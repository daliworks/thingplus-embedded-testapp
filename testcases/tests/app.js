var _ = require('lodash');
var assert = require('chai').assert;
var TcApp = require('../app.js');

function gwStatusTopic(gatewayId) {
  return 'v/a/g/' + gatewayId + '/status';
}

function sensorStatusTopic(gatewayId, sensorId) {
  return 'v/a/g/' + gatewayId + '/s/' + sensorId + '/status';
}

function sensorValueTopic(gatewayId, sensorId) {
  return 'v/a/g/' + gatewayId + '/s/' + sensorId;
}

function sensorsValueTopic(gatewayId) {
  return 'v/a/g/' + gatewayId;
}

function responseTopic(gatewayId) {
  return 'v/a/g/' + gatewayId + '/res';
}

function statusPayload(gwStatus /*, id , sensorStatus, id, sensorStatus, ... */) {
  var payload = '';
  for (var i=0; i<arguments.length; i++) {
    if (_.isString(arguments[i])) {
      if (payload !== '') {
        payload += ',';
      }
      payload +=  arguments[i] + ',';
    }
    else if (_.isObject(arguments[i])) {
      payload += _.join(_.values(arguments[i]), ',');
    }
  }

  return payload;
}

function sensorValuePayload(values) {
  var payload = '';

  _.forEach(values, function (value) {
    if (payload !== '') {
      payload += ',';
    }

    payload += value.t + ',' + value.v;
  });

  payload = '[' + payload + ']';

  return payload;
}

function sensorsValuePayload(sensorInfo /*, sensorInfo, sensorInfo ...*/) {
  var payload ='{';

  _.forEach(arguments, function (arg) {
    if (payload !== '{') {
      payload += ',';
    }

    payload += '\"' + arg.id + '\":'
    payload += sensorValuePayload(arg.value);
  });
  payload += '}';

  return payload;
}

function responsePayload(responseId) {
  var payload = {
    "id": responseId,
    "result": ""
  };

  return JSON.stringify(payload);
}

function assertSensorValue(expect, actual) {
  assert.equal(expect.id, actual.id);
  assert.equal(_.size(expect.value), _.size(actual.value));

  for (var i=0; i<_.size(expect.value); i++) {
    assert.equal(expect.value[i].v, actual.value[i].v);
    assert.equal(expect.value[i].t, actual.value[i].t);
  }
}

function assertStatus(expect, actual) {
  assert.equal(actual.id, expect.id);
  assert.equal(actual.value, expect.status.value);
  assert.equal(actual.timeout, expect.status.timeout);
}

describe('[APP] MQTT PARSER', function () {
  var gatewayId;
  var tcApp;
  var sensor0Info;
  var gatewayInfo;
  beforeEach(function () {
    gatewayId = '012345012345';
    tcApp = new TcApp('../hardware.json');

    gatewayInfo = {
      "id": gatewayId,
      "status" : {
        "value": "on",
        "timeout": 14683483845
      }
    };

    sensor0Info = {
      "id": '000011112222-temperature-0',
      "status": {
        "value": "on",
        "timeout": 14683483845
      },
      "value": [
        {
          "v": 26.5,
          "t": 146156161000,
        },
        {
          "v": 27.5,
          "t": 146156162000,
        },
        {
          "v": 30,
          "t": 146156163000,
        }
      ]
    };

    sensor1Info = {
      "id": '000011112222-humidity-0',
      "status": {
        "value": "on",
        "timeout": 14683483845
      },
      "value": [
        {
          "v": 60,
          "t": 146156171000,
        },
        {
          "v": 70,
          "t": 146156172000,
        },
        {
          "v": 80,
          "t": 146156173000,
        }
      ]
    };
  });

  afterEach(function() {
  });

  it ('Empty Topic', function (done) {
    //given
    var topic;
    var payload = 'a';

    //when
    var messageJson = tcApp.mqttParse(topic, payload, null, cb);

    function cb(err, err_topic, err_payload) {
      assert.equal('empty topic', err.message);
      assert.equal(topic, err_topic);
      assert.equal(payload, err_payload);
      done();
    }
  });

  it ('Invalid Topic Prefix', function (done) {
    //given 
    var topic = 'v/a/d/asdfadsafsa';
    var payload = statusPayload(gatewayInfo.status);

    //when
    var messageJson = tcApp.mqttParse(topic, payload, null, cb);

    //then
    function cb(err, err_topic, err_payload) {
      assert.equal('prefix error', err.message);
      assert.equal(topic, err_topic);
      assert.equal(payload, err_payload);
      done();
    }
  });

  it ('Invalid Sensor Status Topic', function (done) {
    //given
    var topic = 'v/a/g/' + gatewayId + '/d/sensorId/status';
    var payload = 'aaa';

    //when
    tcApp.mqttParse(topic, payload, null, cb);

    //then
    function cb(err, err_topic, err_payload) {
      assert.equal('sensor prefix error', err.message);
      done();
    }
  });

  it ('Invalid Status Topic', function (done) {
    //given
    var topic = 'v/a/g/status/' + gatewayId;
    var payload = statusPayload(gatewayInfo.status);

    //when
    var messageJson = tcApp.mqttParse(topic, payload, null, cb);

    //then
    function cb(err, err_topic, err_payload) {
      assert.equal('unknown topic', err.message);
      done();
    }
  });

  it ('Gateway Status', function (done) {
    //given
    var topic = gwStatusTopic(gatewayId);
    var payload = statusPayload(gatewayInfo.status);

    //when
    tcApp.mqttParse(topic, payload, null, cb);

    //then
   function cb(err, messageJson) {
     assertStatus(gatewayInfo, messageJson.status[0]);
     done();
   }
  });

  it ('Gateway Status With SHORT STATUS VALUE', function (done) {
    //given
    var topic = gwStatusTopic(gatewayId);
    delete gatewayInfo.status.value;
    var payload = statusPayload(gatewayInfo.status);

    //when
    var messageJson = tcApp.mqttParse(topic, payload, null, cb);


    //then
    function cb(err, err_topic, err_payload) {
      assert.equal('short of status', err.message);
      assert.equal(topic, err_topic);
      assert.equal(payload, err_payload);
      done();
    }
  });

  it ('Gateway and Sensor Status Wtih SHORT STATUS VALUE', function (done) {
    //given
    var topic = gwStatusTopic(gatewayId);
    delete sensor0Info.status.value;
    var payload = statusPayload(gatewayInfo.status, sensor0Info.id, sensor0Info.status);

    //when
    var messageJson = tcApp.mqttParse(topic, payload, null, cb);


    //then
    function cb(err, err_topic, err_payload) {
      assert.equal('short of status', err.message);
      assert.equal(topic, err_topic);
      assert.equal(payload, err_payload);
      done();
    }
  });

  it ('Gateway and Sensor Status', function (done) {
    //given
    var topic = gwStatusTopic(gatewayId);
    var payload = statusPayload(gatewayInfo.status, sensor0Info.id, sensor0Info.status);

    //when
    tcApp.mqttParse(topic, payload, null, cb);

    //then
    function cb(err, messageJson) {
      assertStatus(gatewayInfo, messageJson.status[0]);
      assertStatus(sensor0Info, messageJson.status[1]);
      done();
    }
  });

  it ('Single Sensor Status', function (done) {
    //given
    var topic = sensorStatusTopic(gatewayId, sensor0Info.id);
    var payload = statusPayload(sensor0Info.status);

    //when
    tcApp.mqttParse(topic, payload, null, cb);

    //then
    function cb(err, messageJson) {
      assertStatus(sensor0Info, messageJson.status[0]);
      done();
    }
  });

  it ('Single Sensor Value', function (done) {
    //given
    var topic = sensorValueTopic(gatewayId, sensor0Info.id);
    var payload = sensorValuePayload(sensor0Info.value);

    //when
    var messageJson = tcApp.mqttParse(topic, payload, null, cb);

    //console.log(payload);

    //then
    function cb(err, messageJson) {
      assert.equal(sensor0Info.id, messageJson.sensorValue[0].id);
      assertSensorValue(sensor0Info, messageJson.sensorValue[0]);
      done();
    };
  });

  it ('Single Sensor Multple NOT Arrayed Values', function (done) {
    //given
    var topic = sensorValueTopic(gatewayId, sensor0Info.id);
    var payload = sensorValuePayload(sensor0Info.value);

    payload = payload.replace('[', '');
    payload = payload.replace(']', '');

    //when
    var messageJson = tcApp.mqttParse(topic, payload, null, cb);


    //then
    function cb(err, messageJson) {
      assert.equal(sensor0Info.id, messageJson.sensorValue[0].id);
      assertSensorValue(sensor0Info, messageJson.sensorValue[0]);
      done();
    }
  });

  it ('Single Sensor Value With INVALID PAYLOAD', function (done) {
    //given
    var topic = sensorValueTopic(gatewayId, sensor0Info.id);
    var payload = '[146156161000,26.5,146156162000,27.5,146156163000]';
    var time = new Date();

    //when 
    tcApp.mqttParse(topic, payload, time, cb);

    //then
    function cb(err, err_topic, err_payload) {
      assert.equal('short of value', err.message);
      assert.equal(topic, err_topic);
      assert.equal(payload, err_payload);

      var errorMessage = tcApp.getErrorMqttMessage();
      assert.equal(topic, errorMessage[0].topic);
      assert.equal(payload, errorMessage[0].payload);
      assert.equal(time, errorMessage[0].time);
      done();
    }
  });

  it ('Multiple Sensor Value', function (done) {
    //given
    var topic = sensorsValueTopic(gatewayId);
    var payload = sensorsValuePayload(sensor0Info, sensor1Info);

    //when
    var messageJson = tcApp.mqttParse(topic, payload, null, cb);


    //then
    function cb(err, messageJson) {
      assertSensorValue(sensor0Info, messageJson.sensorValue[0]);
      assertSensorValue(sensor1Info, messageJson.sensorValue[1]);
      done();
    }
  });

  it ('Single Sensor Value With Multiple Sensor Topic', function (done) {
    //given
    var topic = sensorsValueTopic(gatewayId);
    var payload = sensorsValuePayload(sensor0Info);

    //when
    var messageJson = tcApp.mqttParse(topic, payload, null, cb);


    //then
    function cb(err, messageJson) {
      assertSensorValue(sensor0Info, messageJson.sensorValue[0]);
      done();
    }
  });

  it ('Multiple Sensor Value With Invalid Payload ', function (done) {
    //given
    var topic = sensorsValueTopic(gatewayId);
    var payload = sensorsValuePayload(sensor0Info);
    payload =payload.replace('{', '');

    //when
    tcApp.mqttParse(topic, payload, null, cb);

    //then
    function cb(err, err_topic, err_payload) {
      assert.equal('value format error', err.message);
      assert.equal(topic, err_topic);
      assert.equal(payload, err_payload);
      done();
    }
  });

  it ('DM Response', function (done) {
    var topic = responseTopic(gatewayId);
    var responseId = "012345";
    var payload = responsePayload(responseId);

    var messageJson = tcApp.mqttParse(topic, payload, null, cb);


    function cb(err, messageJson) {
      assert.equal(payload, JSON.stringify(messageJson));
      done();
    }
  });

  it ('DM Response With INVALID Payload', function (done) {
    var topic = responseTopic(gatewayId);
    var payload = 'ERR_JSON: "ERRJSON_STRING,"';

    tcApp.mqttParse(topic, payload, null, cb);

    function cb(err, err_topic, err_payload) {
      assert.equal('err payload parsing', err.message);
      assert.equal(topic, err_topic);
      assert.equal(payload, err_payload);
      done();
    };
  });
});

describe('[APP] INVALID MQTT MESSAGE SAVE', function () {
  var gatewayId;
  var tcApp;

  beforeEach(function() {
    gatewayId = '012345012345';
    tcApp = new TcApp('../hardware.json');
  });

  afterEach(function () {
  });

  it ('Save Topic and Payload', function() {
    //given
    var topic = 'abcdefg';
    var payload = 'erroredPayload';
    var time = new Date().getTime();

    //when
    tcApp.setErrorMqttMessage(topic, payload, time);

    //then
    var errorMessage = tcApp.getErrorMqttMessage();
    assert.equal(topic, errorMessage[0].topic);
    assert.equal(payload, errorMessage[0].payload);
    assert.equal(time, errorMessage[0].time);
  });
});

/*
{
  "status": [
    {
      "id": "012345012345",
      "value": "on",
      "timeout": "14683483845"
    },
    {
      "id": "01234512345-temperature-0",
      "value": "on",
      "timeout": "14683483845"
    },
    {
      "id": "01234512345-humidity-0",
      "value": "of",
      "timeout": "14683483845"
    },
  ],
  "sensorValue": [
    {
      "id": "01234512345-humidity-0",
      "value": [
        {
          "v": "36",
          "t": "12334838383"
        },
        {
          "v": "46",
          "t": "15838383883"
        },
      ]
    },
    {
      "id": "01234512345-temperature-0",
      "value": [
        {
          "value": "36",
          "time": "12334838383"
        },
        {
          "value": "46",
          "time": "15838383883"
        },
      ]
    },
  ]
  "dm": {
    "id": "e10dkdic",
    "result": "result",
  }
}
*/
