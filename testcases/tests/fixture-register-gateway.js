var fs = require('fs'),
    logger = require('log4js').getLogger('FIXTURE:register-gateway'),
    _ = require('lodash');

var database = require('../../lib/db');

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

  if (database.findOne('gateways', gateway.id)) {
    logger.warn('[registerGateway] %s is registered', gateway.id);
    return;
  }

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
        if (sensorModel.type !=='temperature' && sensorModel.type !== 'led') {
          return true;
        }
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

function registerGatewayToDatabase (config) {
  database.init();

  registerGateway(config);
}

module.exports = registerGatewayToDatabase;
