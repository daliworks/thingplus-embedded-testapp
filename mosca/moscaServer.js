#!/usr/bin/env node
'use strict';

var mosca = require('mosca');

// var pubsubSettings = {
//     /* For AMQP */
//     type: 'amqp',
//     json: false,
//     amqp: require('amqp'),
//     exchange: 'amq.topic'
// };

/**
 * 
 * 
 * @param {any} config
 * @returns
 */
function moscaServerStart(config) {
  var moscaSetting = {
    interfaces: [
      { 
        type: "mqtt", 
        port: 1883 
      },
      { 
        type: "mqtts", 
        port: 8883, 
        credentials: {
          keyPath: config.mqtt.secure.key,
          certPath: config.mqtt.secure.cert 
        }
      }
    ],
    stats: false
    //logger: { name: 'MoscaServer', level: 'debug' },
  };

  /**
   * 
   * 
   * @param {any} client
   * @param {any} username
   * @param {any} password
   * @param {any} callback
   */
  var authenticate = function (client, username, password, callback) {
    if (username == 'clientForActuator') {
      return callback(null, true);
    }

    if (username == config.gateway.id && password.toString() == config.gateway.apikey) {
      callback(null, true);
    }
    else {
      callback(null, false);
    }

    server.emit('gatewayId', username);
    server.emit('apikey', password);
  }

  /**
   * 
   * 
   * @param {any} client
   * @param {any} topic
   * @param {any} payload
   * @param {any} callback
   */
  var authorizePublish = function (client, topic, payload, callback) {
    callback(null, true);
  }

  /**
   * 
   * 
   * @param {any} client
   * @param {any} topic
   * @param {any} callback
   */
  var authorizeSubscribe = function (client, topic, callback) {
    callback(null, true);
  }

  var server = new mosca.Server(moscaSetting);

  server.on('ready', setup);

  /**
   * 
   */
  function setup() {
    server.authenticate = authenticate;
    server.authorizePublish = authorizePublish;
    server.authorizeSubscribe = authorizeSubscribe;

    console.log('Mosca server is up and running.');
  }

  server.on("error", function (err) {
    //console.log(err);
  });

  server.on('clientConnected', function (client) {
    //console.log('Client Connected \t:= ', client.id);
  });

  server.on('published', function (packet, client) {
    //console.log("Published :=", packet);
  });

  server.on('subscribed', function (topic, client) {
    //console.log("Subscribed :=", client.packet);
  });

  server.on('unsubscribed', function (topic, client) {
    //console.log('unsubscribed := ', topic);
  });

  server.on('clientDisconnecting', function (client) {
    //console.log('clientDisconnecting := ', client.id);
  });

  server.on('clientDisconnected', function (client) {
    //console.log('Client Disconnected     := ', client.id);
  });
  return server;
}

/**
 * 
 * 
 * @param {any} server
 */
function moscaServerStop(server) {
  server.close();
  console.log('Mosca server is stopped');
}

exports.start = moscaServerStart
exports.stop = moscaServerStop
