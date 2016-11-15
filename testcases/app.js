var _ = require('lodash');
var async = require('async');
var TcMqtt = require('./mqtt.js');
var MqttParser = require('./mqtt-parser.js');



function Testcases (config) {
  this.hardwareInfo = config;
  this.mqtt = new TcMqtt(config);
  this.mqttParser = new MqttParser(config);
}

module.exports = Testcases;

