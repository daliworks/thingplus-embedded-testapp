#!/usr/bin/env node
'use strict';

var _ = require('lodash'),
    fs = require('fs'),
    http = require('http'),
    logger = require('log4js').getLogger('MAIN');

var mosca = require('./mosca/moscaServer'),
    expressApp = require('./express/app'),
    Tc = require('./testcases/app'),
    database = require('./lib/db'),
    report = require('./reporter');

// var CONFIG_FILE = 'hardware.json';
var CONFIG_FILE = 'config.json';

var mqttBroker,
    httpServer,
    testcases,
    mqttConnected = false;

/**
 * loading config file
 * 
 * @returns config data
 */
function loadConfig() {
  var config, file;
  
  if(fs.existsSync(CONFIG_FILE)) {
    try {
      file = fs.readFileSync(CONFIG_FILE, 'utf8');
      config = JSON.parse(file);

      logger.info('[loadConfig] config loading file success. config=', JSON.stringify(config));
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

/**
 * create test case
 * 
 * @param {object} config
 * @returns
 */
function createTestCase(config) {
  var tc = new Tc(config);
  return tc;
}

/**
 * generate id with token
 * 
 * @param {string} str
 * @param {object} tokens
 * @returns
 */
function registerIdTemplate(str, tokens) {
 return str && str.replace(/\{(\w+)\}/g, function (x, key) {
    return tokens[key];
  });
}

/**
 * create sensor data with sensorDrive info 
 * 
 * @param {string} gatewayId
 * @param {string} deviceId
 * @param {object} sensorModel
 * @returns
 */
function registerSensor(gatewayId, deviceId, sensorModel) {
  var sensor, sensorId, sensorDriverInfo;

  sensorDriverInfo = database.findOne('sensorDrivers', sensorModel.driverName);

  sensorId = registerIdTemplate(sensorDriverInfo.idTemplate, {
                    model: sensorModel.model,
                    gatewayId: gatewayId,
                    // FIXME: where is deviceAddress in GatewayModel???
                    deviceAddress: deviceId,
                    sequence: sensorModel.sequence,
                    type: sensorModel.type
                  });
  
  sensor = _.clone(sensorModel);
  sensor.id = sensorId;
  sensor.owner = gatewayId;
  sensor.deviceId = deviceId;
  sensor.name = sensor.type + '_' + (_.isUndefined(sensor.sequence) ? 1 : sensor.sequence);
  sensor.ctime = (Date.now()).toString();

  return sensor;
}

/**
 * create device data with device model info 
 * 
 * @param {string} gatewayId
 * @param {object} deviceModel
 * @returns
 */
function registerDevice(gatewayId, deviceModel) {

  var device, deviceId;

  deviceId = registerIdTemplate(deviceModel.idTemplate, {
    gatewayId: gatewayId,
    // FIXME: where is deviceAddress in GatewayModel???
    deviceAddress: deviceModel.id
  });

  device = {
    id: deviceId || gatewayId,
    model: deviceModel.id,
    name: deviceModel.displayName,
    owner: gatewayId,
    ctime: (Date.now()).toString()
  };

  return device;
}

/**
 * create gateway data and insert into database
 * 
 * @param {object} config
 * @returns
 */
function registerGateway(config) {
  var gateway = {}, devices = [], sensors = [], gatewayOpt = config.gateway, gatewayModelInfo;

  if (!gatewayOpt) {
    logger.error('[registerGateway] undefined config.gateway');
    return;
  }

  if (_.isUndefined(gatewayOpt.id)) {
    logger.error('[registerGateway] not found id. config=', gatewayOpt);
    return;
  }

  gateway.id = gatewayOpt.id;

  if (_.isUndefined(gatewayOpt.apikey)) {
    logger.error('[registerGateway] not found apikey. config=', gatewayOpt);
    return;
  }

  gateway.apikey = gatewayOpt.apikey;

  if (_.isUndefined(gatewayOpt.reportInterval) || isNaN(gatewayOpt.reportInterval)) {
    logger.error('[registerGateway] not found reportInterval or not a number. config=', gatewayOpt);
    return;
  }

  // second to millisecond and change to string
  gateway.reportInterval = (parseInt(gatewayOpt.reportInterval, 10) * 1000).toString();

  if (_.isUndefined(gatewayOpt.model)) {
    logger.error('[registerGateway] not found model. config=', gatewayOpt);
    return;
  }

  gateway.model = gatewayOpt.model;
  gatewayModelInfo = database.findOne('gatewayModels', gateway.model);

  if (!gatewayModelInfo) {
    logger.error('[registerGateway] invalid gateway model. model id=', gateway.model);
    return;
  }

  gateway.name = gatewayModelInfo.displayName;

  // register devices
  _.forEach(gatewayModelInfo.deviceModels, function (deviceModel) {
    var registerDeviceInfo;

    if (deviceModel.discoverable === 'n') {
      registerDeviceInfo = registerDevice(gateway.id, deviceModel);
      _.forEach(deviceModel.sensors, function (sensorModel) {
        var registerSensorInfo = registerSensor(gateway.id, deviceModel.id, sensorModel);

        if (registerSensorInfo) {
          sensors.push(registerSensorInfo);
        }
      });
    }
    
    if (registerDeviceInfo) {
      devices.push(registerDeviceInfo);
    }
  });

  gateway.devices = _.map(devices, 'id');

  gateway.sensors = _.map(sensors, 'id');
  gateway.ctime = (Date.now()).toString();

  database.insertOne('gateways', gateway);
  database.insertMany('sensors', sensors);
  database.insertMany('devices', devices);
}

/**
 * start mqtt broker(mosca)
 * 
 * @param {object} config
 * @param {object} tc
 * @param {function} cb
 * @returns
 */
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

/**
 * start http server(express)
 * 
 * @param {object} config
 * @param {object} tc
 * @param {function} cb
 * @returns
 */
function runHttpServer(config, tc, cb) {
  var port = config.http && config.http.port || 3000;

  expressApp.set('port', port);

  expressApp.locals.tcRest = tc.rest;

  httpServer = http.createServer(expressApp);

  httpServer.listen(port);

  httpServer.on('error', function (error) {
    if (error.syscall !== 'listen') {
      throw error;
    }

    var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
      case 'EACCES':
        logger.error('[runHttpServer/error] ' + bind + ' requires elevated privileges');
        process.exit(1);
        break;
      case 'EADDRINUSE':
        logger.error('[runHttpServer/error] ' + bind + ' is already in use');
        process.exit(1);
        break;
      default:
        throw error;
    }
  });

  httpServer.on('listening', function onListening() {
    var addr = httpServer.address();
    var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
    logger.info('[runHttpServer] Listening on ' + bind);
  });  

  return cb && cb();
}

/**
 * create report
 */
function generateReport() {
  report(mqttConnected, testcases.mqttParser.getMqttMessage(), testcases.mqttParser.getErrorMqttMessage(),
    testcases.mqtt.errorIdGet(), testcases.mqtt.historyGet(), testcases.rest.historyGet()
  );
}

/**
 * start local-test app
 * 
 * @returns
 */
function start() {
  var config = loadConfig();

  if (!config) {
    logger.error('[start] loading config failed');
    return;
  }

  database.init();

  testcases = createTestCase(config);

  registerGateway(config);

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

/**
 * stop local-test app
 */
function stop() {
  mosca.stop(mqttBroker);
  httpServer.close();

  generateReport();

  setTimeout(function () {
    logger.info('TC STOP');
    process.exit(0);
  }, 1000);  
}

start();

process.on('SIGINT', function () {
  stop();
});
process.on('SIGTERM', function () {
  stop();
});

