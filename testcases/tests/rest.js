var fs = require('fs');
var _ = require('lodash');
var assert = require('chai').assert;
var TcRest = require('../rest.js');
var async = require('async');

describe('[REST]', function () {
  it ('Tc Generation', function (done) {
    var config;
    try {
      config = JSON.parse(fs.readFileSync('../hardware.json', 'utf8'));
    }
    catch (e) {
      throw e;
    }

    var tcRest = new TcRest(config);
    assert.equal('function', typeof tcRest["tcSensorPost-led-90a2da0fc2d8-0"]);
    done();
  });

});

describe('[REST] Tc Run', function () {
  var config = JSON.parse(fs.readFileSync('../hardware.json', 'utf8'));
  var tcRest;

  beforeEach(function () {
    tcRest = new TcRest(config);
  });

  afterEach(function () {
  });

  it ('DevicePost Success', function (done) {
    var deviceInfo = {
      'reqId': 'thingplus',
      'name': 'DummyName',
      'model': 'jsonrpcFullV1.0'
    };

    tcRest.devicePost(deviceInfo, null, function () {
    done();
    });
  });

  it ('SensorPost Success', function (done) {
    var sensorInfo = {
      'network': 'jsonrpc',
      'driverName': 'testDriver',
      'model': 'jsonrpcFullV1.0',
      'type': 'led',
      'category': 'actuator',
      'reqId': 'led-90a2da0fc2d8-0',
      'name': 'DummyName',
      'owner': 'asdf',
      'ctime': '12345',
      'deviceId': 'thingplus'
    };

    tcRest.sensorPost(sensorInfo, null, function () {
      done();
    });
  });

});
