var _ = require('lodash'),
    async = require('async');

var MqttTestcase = require('./mqtt.js'),
    TcRest = require('./rest.js'),
    mqttParser = require('./mqtt-parser.js');


/**
 * Testcases - testcase object
 *
 * @constructor
 * @return
 */
function Testcases () {
  this.mqtt = new MqttTestcase(config.gateway.id);
  this.rest = new TcRest(config);
  this.mqttParser = mqttParser;
  this.mqttParser.init();
}

module.exports = Testcases;
