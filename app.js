#!/usr/bin/env node
'use strict';

var _ = require('lodash'),
    fs = require('fs'),
    logger = require('log4js').getLogger('main');

var mosca = require('./mosca/moscaServer.js'),
    Tc = require('./testcases/app.js'),
    report = require('./reporter.js');

var CONFIG_FILE = 'hardware.json';

var mqttBroker,
    testcases,
    mqttConnected = false;

function loadConfig() {
  var config, file;
  
  if(fs.existsSync(CONFIG_FILE)) {
    file = fs.readFileSync(CONFIG_FILE, 'utf8');

    try {
      file = fs.readFileSync(CONFIG_FILE, 'utf8');
      config = JSON.parse(file);

      logger.info('[loadConfig] config loading file success. config=', config);
    }
    catch (e) {
      logger.error('[loadConfig] config json pasing failed. error=', e);
      // throw e;
    }
  } else {
    logger.error('[loadConfig] file not found. ', CONFIG_FILE);
  }

  return config;
}

function createTestCase(config) {
  var tc = new Tc(config);
  return tc;
}

function runMqttBroker(config, tc, cb) {
  mqttBroker = mosca.start(config);

  if (!mqttBroker) {
    logger.error('[runMqttBroker] create failed');
    return cb && cb('mqttBroker create failed');
  }

  mqttBroker.on('clientConnected', function (client) {
    var time = new Date();

    logger.info('[runMqttBroker] MQTT CONNECTED. clinet', client);

    mqttConnected = true;

    tc.mqtt.tcCleanSession(client.clean, time);
    tc.mqtt.tcWillMessage(client.will, time);
    tc.mqtt.tcKeepalive(client.keepalive, time);
  });

  mqttBroker.on('published', function (packet, client) {
    var time = new Date();

    if (_.startsWith(packet.topic, '$SYS')) {
      return;
    }

    tc.mqttParser.parse(packet.topic, packet.payload.toString(), time, function (err, msg) {
      if (err) {
        logger.error('[runMqttBroker/published] mqtt parsing failed. error=', err);
        return;
      }

      if (msg.status) {
        tc.mqtt.statuses(msg.status);
      }

      if (msg.sensorValue) {
        tc.mqtt.sensorValues(msg.sensorValue);
      }
    });
  });

  mqttBroker.on('gatewayId', function (gatewayId) {
    tc.mqtt.tcGatewayId(gatewayId);
  });

  mqttBroker.on('apikey', function (apikey) {
    tc.mqtt.tcApikey(apikey.toString());
  });

  mqttBroker.on('keepalive', function (keepalive) {
    tc.mqtt.tcKeepalive(keepalive);
  });

  return cb && cb();
}

function runHttpServer(config, tc, cb) {

  return cb && cb();
}


function generateReport() {
  report(mqttConnected, testcases.mqttParser.getMqttMessage(), testcases.mqttParser.getErrorMqttMessage(),
    testcases.mqtt.errorIdGet(), testcases.mqtt.historyGet()
  );
}


function start() {
  var config = loadConfig();

  if (!config) {
    logger.error('[start] loading config failed');
    return;
  }

  testcases = createTestCase(config);

  if (!testcases) {
    logger.error('[start] create test case failed');
    return;
  }

  runMqttBroker(config, testcases, function (err) {
    if (err) {
      logger.error('[start] run mqtt broker failed. error=', err);
    } else {
      logger.info('[start] run mqtt broker');
    }
  });
  
  runHttpServer(config, testcases, function (err) {
    if (err) {
      logger.error('[start] run http server failed. error=', err);
    } else {
      logger.info('[start] run http server');
    }
  });
}

function stop() {
  mosca.stop(mqttBroker);

  generateReport();
}

start();

process.on('SIGINT', function () {
  stop();
});
process.on('SIGTERM', function () {
  stop();
});

