var logger = require('log4js').getLogger('MOCHA:MQTT'),
    fs = require('fs'), _ = require('lodash'),
    assert = require('chai').assert;

var database = require('../../lib/db'),
    MqttTestcases = require('../_mqtt.js'),
    fixtureConfig = require('./fixture-config.js'),
    fixtureRegisterGateway = require('./fixture-register-gateway.js')(fixtureConfig);

var gatewayStatus = {
  'id': fixtureConfig.gateway.id,
  'value': 'on',
  'timeout': '14683483845'
};

var temperatureStatus = {
  'id': 'temperature-90a2da0fc2d8-0',
  'value': 'on',
  'timeout': '14683483845'
};

var onoffStatus = {
  'id': 'onoff-90a2da0fc2d8-0',
  'value': 'off',
  'timeout': '14683484038d'
};

var temperatureValues = {
  'id': 'temperature-90a2da0fc2d8-0',
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
};

var onoffValues = {
  'id': 'onoff-90a2da0fc2d8-0',
  "value": [
    {
      "v": "on",
      "t": "12334838923"
    },
    {
      "v": "off",
      "t": "15838383444"
    },
  ]
};

describe('[MqttTestcases] Construct:', function () {
  beforeEach(function () {
  });

  afterEach(function () {
  });

  it ('construct', function (){
    var mqttTestcases = new MqttTestcases();
  });

  it ('static testcases added', function () {
    //when
    var mqttTestcases = new MqttTestcases(fixtureConfig.gateway.id);

    //then
    var testcases = mqttTestcases.getTestcases();
    assert.equal(typeof testcases.gatewayId, 'function');
  });
});

describe('[MqttTestcases] testcases', function () {
  var mqttTestcases = new MqttTestcases(fixtureConfig.gateway.id);

  it('gatewayId success', function () {
    //given
    var gatewayId = fixtureConfig.gateway.id;

    //when
    mqttTestcases.testcases.gatewayId(gatewayId);

    //then
    var results = mqttTestcases.getResults('gatewayId');
    assert.equal(results[0].error, undefined);
  });

  it ('apikey success', function () {
    //given
    var apikey = fixtureConfig.gateway.apikey;

    //when
    mqttTestcases.testcases.apikey(apikey);

    //then
    var results = mqttTestcases.getResults('apikey');
    assert.equal(results[0].error, undefined);
  });

  it ('keepalive success', function () {
    //given
    var keepalive = fixtureConfig.gateway.reportInterval * 2;

    //when
    mqttTestcases.testcases.keepalive(keepalive);

    //then
    var results = mqttTestcases.getResults('keepalive');
    assert.equal(results[0].error, undefined);
  });

  it ('willMessage success', function () {
    //given
    var willMessage = {
      'topic': 'v/a/g/' + fixtureConfig.gateway.id + '/mqtt/status',
      'payload': new Buffer('err'),
      'qos': 1,
      'retain': true
    };

    //when
    mqttTestcases.testcases.willMessage(willMessage);

    //then
    var results = mqttTestcases.getResults('willMessage');
    assert.equal(results[0].error, undefined);
  });
});

describe('MqttTestcases] dynamic testcases:', function () {

  var mqttTestcases;

  before (function () {
    mqttTestcases = new MqttTestcases(fixtureConfig.gateway.id);
  });

  afterEach (function () {
    mqttTestcases.clearHistory();
  });

  it ('gatewayStatus success', function () {
    //given
    var status = [gatewayStatus];

    //when
    mqttTestcases.testcases.status(status);

    //then
    var results = mqttTestcases.getResults('status');
    assert.equal(results[0].error, undefined);
    assert.notEqual(results[0].data, undefined);
  });

  it ('gatewayStatus and sensorStatus success', function () {
    var status = [gatewayStatus, temperatureStatus];

    //mqttTestcases.gatewayOrSensorStatus(status);
    mqttTestcases.testcases.status(status);

    var results = mqttTestcases.getResults('status');
    assert.equal(results[0].error, undefined);
    assert.equal(results[1].error, undefined);
  });

  it ('sensorStatus with invalid id', function () {
    var status = [onoffStatus];

    mqttTestcases.testcases.status(status);

    var results = mqttTestcases.getResults('status');
    assert.notEqual(results[0].error, undefined);
  });

  it ('sensorValue success', function () {
    var values = [temperatureValues];

    mqttTestcases.testcases.sensorValues(values);

    var results = mqttTestcases.getResults('sensorValues');

    assert.equal(results[0].error, undefined);
  });

  it ('sensorValue with invalid id', function () {
    var values = [onoffValues];

    mqttTestcases.testcases.sensorValues(values);

    var results = mqttTestcases.getResults('sensorValues');

    assert.notEqual(results[0].error, undefined);
  });

  it ('sensorValue with Invalid time', function () {
    var values = [temperatureValues];
    values[0].value[0].t = 'di8dk10383kd03';

    mqttTestcases.testcases.sensorValues(values);

    var results = mqttTestcases.getResults('sensorValues');
    var errorResult = _.filter(results, function (r) {
      return !_.isUndefined(r.error) && r.data.id === values[0].id;
    });

    assert.equal(_.size(errorResult), 1);
  });

  it ('sendAcutatorCommands success', function (done) {
    var doneCalled;
    mqttTestcases.on('publishMqttMessage', function (message) {
      if (doneCalled) {
        return;
      }

      doneCalled = true;
      done();
    });

    mqttTestcases.sendActuatorCommands(mqttTestcases);
  });
});

describe('[MqttTestcases] results', function () {
  var mqttTestcases;

  before (function () {
    mqttTestcases = new MqttTestcases(fixtureConfig.gateway.id);
  });

  it ('missing sensors at status testcases', function () {
    var results = mqttTestcases.getResults('status');
    assert.notEqual(results[0].error, undefined);
  });

  it ('missing sensors at value testcases', function () {
    //when
    var results = mqttTestcases.getResults('sensorValues');

    assert.notEqual(results[0].error, undefined);
  });

  it ('missing sensors value testcase with no argument getResults', function () {
    var results = mqttTestcases.getResults();

    assert.notEqual(results.sensorValues[0].error, undefined);
  });
});
