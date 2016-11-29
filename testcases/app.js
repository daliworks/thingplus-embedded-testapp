var _ = require('lodash'),
    async = require('async');

var MqttTestcase = require('./mqtt.js'),
    TcRest = require('./rest.js'),
    mqttParser = require('./mqtt-parser.js');

/**
 * 
 * 
 * @param {any} config
 */
function Testcases (config) {
  this.hardwareInfo = config;
  this.mqtt = new MqttTestcase(config.gateway.id);
  this.rest = new TcRest(config);
  this.mqttParser = mqttParser;
  this.mqttParser.init();
}

module.exports = Testcases;

