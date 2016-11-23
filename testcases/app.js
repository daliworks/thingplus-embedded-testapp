var _ = require('lodash');
var async = require('async');
var TcMqtt = require('./mqtt.js');
var TcRest = require('./rest.js');
var MqttParser = require('./mqtt-parser.js');



/**
 * 
 * 
 * @param {any} config
 */
function Testcases (config) {
  this.hardwareInfo = config;
  this.mqtt = new TcMqtt(config);
  this.rest = new TcRest(config);
  this.mqttParser = new MqttParser(config);
}

module.exports = Testcases;

