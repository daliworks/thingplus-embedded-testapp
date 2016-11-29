var fs = require('fs');
var _ = require('lodash');
var assert = require('chai').assert;
var TcMqtt = require('../mqtt.js');
var async = require('async');

function gatewayStatus() {
  return {'id': '012345012345',
    'value': 'on',
    'timeout': '14683483845'
  };
}

function sensor0Status() {
  return {'id': '012345012345-0',
    'value': 'on',
    'timeout': '14683483845'
  };
}

function sensor1Status() {
  return {'id': '012345012345-2',
    'value': 'off',
    'timeout': '14683484038d'
  };
}

function sensor0Value() {
  return {
    "id": "012345012345-2",
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
}

function sensor1Value() {
  return {
    "id": "012345012345-0",
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
}

describe('[MQTT] TC GENERATION', function () {
  it ('', function (done) {
    var config;
    try {
      config = JSON.parse(fs.readFileSync('../hardware.json', 'utf8'));
    }
    catch (e) {
      throw e;
    }
    var tcMqtt = new TcMqtt(config);
    assert.equal('function', typeof tcMqtt["tcStatus-90a2da0fc2d8"]);
    assert.equal('function', typeof tcMqtt["tcStatus-led-90a2da0fc2d8-0"]);
    done();

  });
});

describe('[MQTT] TC', function () {
  var config;
  var dummyRaw = {'topic': 'v/a/g/dummpyTopic', 'payload': 'dummyPayload'};
  var tcMqtt = new TcMqtt(JSON.parse(fs.readFileSync('../hardware.json', 'utf8')));
  var gatewayId;
  var gatewayInfo;

  beforeEach(function() {
    gatewayId = '012345012345';
    gatewayInfo = {
      "id": gatewayId,
      "status" : {
        "value": "on",
        "timeout": 14683483845
      }
    };
  });

  afterEach(function() {
  });

  function equalitySuccess(done, name, value) {
    //when
    tcMqtt[name](value, null, cb);

    //then
    function cb() {
      done();
    }
  }

  function equalityFail(done, name, value) {
    //when
    tcMqtt[name](value, null, cb);

    //then
    function cb() {
      done();
    }
  }

  it ('cleanSession Success', function (done) {
    //given
    var cleanSession = true;

    //when then
    equalitySuccess(done, 'tcCleanSession', cleanSession);
  });

  it ('keepalive Success', function (done) {
    //given
    var keepalive = 60;

    //when then
    equalitySuccess(done, 'tcKeepalive', keepalive);
  });

  it ('keepalive Success', function (done) {
    //given
    var keepalive = 30;

    //when then
    equalityFail(done, 'tcKeepalive', keepalive);
  });

  it ('apikey Success', function (done) {
    //given
    var apikey = "testApikey";

    //when then
    equalitySuccess(done, 'tcApikey', apikey);
  });

  it ('gatewayId Success', function(done) {
    //given
    var gatewayId = '012345012345';

    //when then
    equalitySuccess(done, 'tcGatewayId', gatewayId);
  })

  it ('gateawyId Failed', function (done) {
    //given
    var gatewayId = 'asdf';

    equalityFail(done, 'tcGatewayId', gatewayId);
  });

  it ('gatewayId Tc History Get', function (done) {
    var gatewayId;

    //given
    async.series([
      function (asyncDone) {
        gatewayId = '90a2da0fc2d8'
        equalitySuccess(asyncDone, 'tcGatewayId', gatewayId);
      },
      function (asyncDone) {
        gatewayId = 'wrongId'
        equalityFail(asyncDone, 'tcGatewayId', gatewayId);
      }],
      function () {
        //when
        var history = tcMqtt.historyGet('tcGatewayId');

        //then
        assert.equal(false, history[0].result);
        assert.equal(false, history[1].result);
        assert.equal(true, history[2].result);
        done();
      });
  });

  it ('gateway Status Success', function (done) {

    //given
    var status = [gatewayStatus()]

    //when
    tcMqtt.statuses(status, null, dummyRaw, cb);

    //then
    function cb(result, testedData) {
      done();
    }
  });

  it ('gateway Status Invalid Value', function (done) {
    //given
    var status = [gatewayStatus()]
    status[0].value = 'offfffod';

    //when
    tcMqtt.statuses(status, null, dummyRaw, cb);

    //then
    function cb(result) {
      done();
    }
  });

  it ('gateway Status Invalid Timeout', function (done) {
    //given
    var status = [gatewayStatus()]
    status[0].timeout = '19393dd83kd83&&';

    tcMqtt.statuses(status, null, dummyRaw, cb);

    //then
    function cb(result) {
      done();
    }
  });

  it ('sensor Status Success', function (done) {
    //given
    var status = [
      {'id': '012345012345-0',
        'value': 'on',
        'timeout': '14683483845'
      }
    ];

    tcMqtt.statuses(status, null, dummyRaw, cb);

    //then
    function cb(result) {
      done();
    }
  });

  it ('Gateway and Sensor Status Success', function (done) {
    var status = [gatewayStatus(), sensor0Status()];

    tcMqtt.statuses(status, null, dummyRaw, cb);

    //then
    function cb(result) {
      done();
    }
  });

  it ('Gateway and Sensor Status Failed with Invalid Sensor Id', function (done) {
    //given
    var status = [sensor0Status(), sensor1Status()];
    status[1].id = "DICKDIEKD_SENSORID";

    tcMqtt.statuses(status, null, dummyRaw, cb);

    //then
    function cb(result) {
      done();
    }
  });

  it ('Gateway and Sensor Status Failed with Invalid Timeout', function (done) {
    //given
    var status = [sensor0Status(), sensor1Status()];
    status[1].timeout = "14338INVALID83845";

    tcMqtt.statuses(status, null, dummyRaw, cb);

    //then
    function cb(result) {
      done();
    }
  });

  it ('Gateway and Sensor Status Failed with Invalid Timeout and Value', function (done) {
    //given
    var status = [gatewayStatus(), sensor0Status(), sensor1Status()];
    status[0].id = 'D*k38dkdid_ID';
    status[1].timeout = '14338INVALID83845';

    //when
    tcMqtt.statuses(status, null, dummyRaw, cb);

    //then
    function cb(result) {
      done();
    }
  });

  it ('Sensor Value Success', function (done) {
    //given
    var value = [sensor0Value()];

    //when
    tcMqtt.sensorValues(value, new Date(), dummyRaw, cb); 

    //then
    function cb(result) {
      done();
    }
  });

  it ('Multiple Sensor Value Success', function (done) {
    //given
    var value = [sensor0Value(), sensor1Value()];

    //when
    tcMqtt.sensorValues(value, new Date(), dummyRaw, cb); 

    //then
    function cb(result) {
      done();
    }
  });

  it ('Sensor Value With Invalid time', function (done) {
    //given
    var value = [sensor0Value(), sensor1Value()];
    value[0].value[0].t = 'di8dk10383kd03';

    //when
    tcMqtt.sensorValues(value, new Date(), dummyRaw, cb); 

    //then
    function cb(result) {
      done();
    }
  });

  it ('Sensor Value With Invalid id', function (done) {
    //given
    var value = [sensor0Value(), sensor1Value()];
    value[0].id = 'Id,dididsl';

    //when
    tcMqtt.sensorValues(value, new Date(), dummyRaw, cb); 

    //then
    function cb(result) {
      done();
    }
  });
});

describe('[Actuator]', function () {
  var config;

  try {
    config = JSON.parse(fs.readFileSync('../hardware.json', 'utf8'));
  }
  catch (e) {
    throw e;
  }

  var tcMqtt;
  var sensorTypes = JSON.parse(fs.readFileSync('../sensorTypes.json', 'utf8'));

  beforeEach(function () {
    tcMqtt = new TcMqtt(config);
  });

  afterEach(function () {
  });

  it ('sendActuatorCmds', function (done) {
    tcMqtt.sendActuatorCmds(function cb() {
    });

    //console.log(sensorTypes);
    done();
  });

  it ('', function (done) {
    tcMqtt.sendActuatorCmds();
    setTimeout(function () {
      tcMqtt.tcApikey();
    }, 3000);
  });

});

