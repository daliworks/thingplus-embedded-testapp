#!/usr/bin/env node
'use strict';

var mqtt = require('mqtt'),
    fs = require('fs'),
    path = require('path');

//var CERT = fs.readFileSync(path.join(__dirname, '/mosca/test/secure/tls-cert.pem'));

var SECURE_PORT = 8883,
    UNSECURE_PORT = 1883,
    HOST = 'localhost';

// var options = {
//   port: SECURE_PORT,
//   host: HOST,
//   username: 'test',
//   password: 'test',
//   cert: CERT,
//   protocol: 'mqtts',
//   rejectUnauthorized: false
// };

var options = {
  port: UNSECURE_PORT,
  host: HOST,
  username: '012345012345',
  password: 'testApikey'
};

var client = mqtt.connect(options);

client.subscribe('messages');
client.publish('messages', 'Current time is: ' + new Date());
client.on('message', function(topic, message) {
  console.log(message);
});
