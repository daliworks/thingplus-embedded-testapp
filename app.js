var _ = require('lodash');
var fs = require('fs');
var mosca = require('./mosca/moscaServer.js');
var Tc = require('./testcases/app.js');
var report = require('./reporter.js');

var CONFIG_FILE = 'hardware.json';

var config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}
catch (e) {
  throw e;
}

var mqttServer;
var testcases;
var mqttConnected = false;

function start() {
  testcases = new Tc(config);
  mqttServer = mosca.start(config);

  mqttServer.on('clientConnected', function (client) {
    console.log('MQTT CONNECTED');
    mqttConnected = true;

    var time = new Date();

    testcases.mqtt.tcCleanSession(client.clean, time);
    testcases.mqtt.tcWillMessage(client.will, time);
    testcases.mqtt.tcKeepalive(client.keepalive, time);
  });

  mqttServer.on('published', function (packet, client) {
    if (_.startsWith(packet.topic, '$SYS')) {
      return;
    }

    var time = new Date();

    testcases.mqttParser.parse(packet.topic, packet.payload.toString(), time, function (err, msg) {
      if (err) {
        console.log(err);
        return;
      }

      if (msg.status) {
        testcases.mqtt.statuses(msg.status);
      }

      if (msg.sensorValue) {
        testcases.mqtt.sensorValues(msg.sensorValue);
      }
    });
  });

  mqttServer.on('gatewayId', function (gatewayId) {
    testcases.mqtt.tcGatewayId(gatewayId);
  });

  mqttServer.on('apikey', function (apikey) {
    testcases.mqtt.tcApikey(apikey.toString());
  });

  mqttServer.on('keepalive', function (keepalive) {
    testcases.mqtt.tcKeepalive(keepalive);
  });
};

function stop() {
  mosca.stop(mqttServer);
  report(mqttConnected, testcases.mqttParser.getMqttMessage(), testcases.mqttParser.getErrorMqttMessage(),
    testcases.mqtt.errorIdGet(), testcases.mqtt.historyGet()
  ) ;
  //process.exit();
}

start();

process.on('SIGINT', function () {
  stop();
});
process.on('SIGTERM', function () {
  stop();
});

