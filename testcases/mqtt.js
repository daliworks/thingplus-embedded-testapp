var _ = require('lodash'),
    util = require('util'),
    async = require('async'),
    Ajv = require('ajv'),
    events =require('events'),
    randomstring = require('randomstring'),
    logger = require('log4js').getLogger('TC:MQTT');

var database = require('../lib/db');

var STATUS_TESTCASE_PREFIX = 'status-';
var VALUE_TESTCASE_PREFIX = 'value-';
var ACTUATOR_CMD_RESPONSE_TIMEOUT_MS = 30000;

/**
 * _sendActuatorCommand - send actuator commands
 *
 * @param  {object} actuator
 * @param  {object} actuatorType
 * @param  {function} cb
 */
 function _sendActuatorCommand(actuator, actuatorType, cb) {
  var that = this;
  var topic = 'v/a/g/' + this.gatewayId + '/req';

  async.eachOfSeries(actuatorType.commands, function (options, cmd, asyncDone) {
    var message = {};
    message.id = randomstring.generate({
      length:9,
      charset:'alphabetic'
    });

    message.method = 'controlActuator';
    message.params = {};
    message.params.id = actuator.id;
    message.params.cmd = cmd;
    message.params.options = {};

    _.forEach(options, function (option) {
      if (option.required) {
        if (option.type === 'text') {
          message.params.options[option.name] = 'dummyText';
        }
        else if (option.type === 'number') {
          message.params.options[option.name] = option.min;
        }
      }
    });

    logger.info('[sendActuatorCommand] cmd:%s opt:%s', cmd, JSON.stringify(message.params.options));

    that.emit('publishMqttMessage', {'topic':topic, 'payload':JSON.stringify(message)});
    that.sentActuatorCommands[message.id] = {'type': actuator.type,
      'cmd': cmd, 'message': message, 'time': Date.now()};
    setTimeout(function () {
      asyncDone();
    }, 1000);
  }, function () {
    cb();
  });
}

/**
 * _actuatorCommandResponseTestcase - verify response of actuator commands
 *
 * @param  {object} response
 * @param  {number} time
 */
function _actuatorCommandResponseTestcase (response, time) {
  var error, sensorTypes;
  var sentActuatorCommand = this.sentActuatorCommands[response.id];
  var that = this;

  if (!time) {
    time = Date.now();
  }

  if (!sentActuatorCommand) {
    error = util.format('invalid response id(%s)', response.id);
    delete this.sentActuatorCommands[response.id];
    that.setResults('actuatorResponse', error, response, time);
    return;
  }

  if (time > sentActuatorCommand.time + ACTUATOR_CMD_RESPONSE_TIMEOUT_MS) {
    error = util.format('response timeout');
    delete this.sentActuatorCommands[response.id];
    that.setResults('actuatorResponse', error, response, time);
    return;
  }

  sensorTypes = database.findAll('sensorTypes');

  var sensorType = _.filter(sensorTypes, {'id': sentActuatorCommand.type})[0];
  if (_.isUndefined(sensorType)) {
    error = util.format('unknown sensorType(%s)', sentActuatorCommand.type);
    that.setResults('actuatorResponse', error, response, time);
    return;
  }

  var ajv = new Ajv();
  var validate = ajv.compile(sensorType.contentType);
  var valid = validate(response);

  if (!valid) {
    error = 'invalid response';
  }

  this.setResults('actuatorResponse', error, response, time);

  delete this.sentActuatorCommands[response.id];
}


/**
 * _sensorStatusTestcase - verify gateway or sesnor status
 *
 * @param  {array} statusArray
 * @param  {number} time
 */
function _sensorStatusTestcase (statusArray, time) {
  var that = this;
  var testcaseName, error;

  var sensors = database.findAll('sensors');
  var sensorInfo;

  _.forEach(statusArray, function (status) {
    error = undefined;

    if (status.id !== that.gatewayId) {
      sensorInfo = _.filter(sensors, function (s) {
        return s.id === status.id;
      });

      if (_.isEmpty(sensorInfo)) {
        error = util.format('invalid id(%s)', status.id);
        that.setResults('status', error, status, time);
        return true;
      }
    }

    if (!_.includes(['on', 'off'], status.value.toLowerCase())) {
      error = util.format('invalid status(%s)', status.value);
      that.setResults('status', error, status, time);
      return;
    }

    if (!status.timeout || _.isNaN(status.timeout)) {
      error = 'invalid timeout';
    }

    that.setResults('status', error, status, time);
  });
}

/**
 * _sensorValuesTestcase - veryfi sensor values
 *
 * @param  {object} sensorValues
 * @param  {number} time
 */
function _sensorValuesTestcase (sensorValues, time) {
  var that = this;
  var testcaseName, error;

  var sensors = database.findAll('sensors');

  _.forEach(sensorValues, function (sensorValue) {
    var sensorInfo = _.filter(sensors, function (s) {
      return s.id === sensorValue.id && s.category === 'sensor';
    });

    error = undefined;

    if (_.isEmpty(sensorInfo)) {
      error = util.format('invalid id(%s)', sensorValue.id);
      that.setResults('sensorValues', error, sensorValue, time);
      return true;
    }

    _.forEach(sensorValue.value, function (v) {
      if (!v.t || isNaN(v.t)) {
          error = 'invalid time(' + v.t + ')';
          return false;
      }
    });

    that.setResults('sensorValues', error, sensorValue, time);
  });
}

/**
 * _gatewayIdTestcase - verify gatewayId
 *
 * @param  {string} gatewayId
 * @param  {number} time
 */
function _gatewayIdTestcase(gatewayId, time) {
  var error;

  logger.info('gatewayId testcase running');

  if (!_.isEqual(gatewayId, this.gatewayId)) {
      error = 'gatewayId is not match. expect:' + this.gatewayId + ' recevice:' + gatewayId;
  }

  this.setResults('gatewayId', error, gatewayId, time);
}

/**
 * _apikeyTestcase - verify apikey
 *
 * @param  {string} apikey
 * @param  {number} time
 */
function _apikeyTestcase (apikey, time) {
  logger.info('apikey verifing');

  var error;
  var gatewayInfo = database.findOne('gateways', this.gatewayId);
  if (_.isUndefined(gatewayInfo)) {
    logger.error('gatewayInfo is not in the db');
    return;
  }

  if (!_.isEqual(gatewayInfo.apikey, apikey)) {
    error = 'apikey is not match. expect:' + gatewayInfo.apikey + ' receive:' + apikey;
  }

  this.setResults('apikey', error, apikey, time);
}

/**
 * _keepaliveTestcase - verify keepalive
 *
 * @param  {number} keepalive
 * @param  {number} time
 */
function _keepaliveTestcase (keepalive, time) {
  logger.info('keepalive verifing');

  var MAX_KEEPALIVE = 60 * 10;
  var error, expectKeepalive;
  var gatewayInfo = database.findOne('gateways', this.gatewayId);
  if (_.isUndefined(gatewayInfo)) {
    logger.error('gatewayInfo is not in the db');
    return;
  }

  expectKeepalive = gatewayInfo.reportInterval/1000 * 2;
  if (expectKeepalive > MAX_KEEPALIVE) {
    expectKeepalive = MAX_KEEPALIVE;
  }

  if (!_.isEqual(expectKeepalive, keepalive)) {
    error = 'keepalive is not match. expect:' + expectKeepalive + ' receive:' + keepalive;
  }

  this.setResults('keepalive', error, keepalive, time);
}

/**
 * _willMessageTestcase - verify will message
 *
 * @param  {object} willMessage
 * @param  {number} time
 */
function _willMessageTestcase (willMessage, time) {
  logger.info('willMessage verifing');

  var error;
  var expectWillMessage = {
    'topic': 'v/a/g/' + this.gatewayId + '/mqtt/status',
    'payload': new Buffer('err'),
    'qos': 1,
    'retain': true
  };

  if (!_.isEqual(expectWillMessage, willMessage)) {
    error = 'willMessage is not match. expect:' + expectWillMessage + ' recevice:' + willMessage;
  }

  this.setResults('willMessage', error, willMessage, time);
}

/**
 * _cleanSessionTestcase - verify clean sessin
 *
 * @param  {boolean} cleanSession
 * @param  {number} time
 */
function _cleanSessionTestcase (cleanSession, time) {
  logger.info('cleanSession testcase running');

  var error;
  var expectCleanSession = true;

  if (!_.isEqual(expectCleanSession, cleanSession)) {
    error = 'clean session is not match. expect:true but receive false';
  }

  this.setResults('cleanSession', error, cleanSession, time);
}

/**
 * MqttTestcases - MqttTestcases Object
 *
 * @constructor
 * @param  {string} gatewayId
 */
function MqttTestcases (gatewayId) {
  logger.info('new instance. gatewayId:%s', gatewayId);

  this.gatewayId = gatewayId;
  this.testcases = {};
  this.results = {};
  this._testcasesInit();
}

util.inherits(MqttTestcases, events.EventEmitter);

/**
 * getTestcases - get mqtt testcases
 *
 */
MqttTestcases.prototype.getTestcases = function () {
  return this.testcases;
};

/**
 * _testcaseInit - initialize testcases
 *
 */
MqttTestcases.prototype._testcasesInit = function () {
  var that = this;
  var staticTestcases = [
    {'name': 'gatewayId', 'testcase': _gatewayIdTestcase},
    {'name': 'apikey', 'testcase': _apikeyTestcase},
    {'name': 'keepalive', 'testcase': _keepaliveTestcase},
    {'name': 'willMessage', 'testcase': _willMessageTestcase},
    {'name': 'cleanSession', 'testcase': _cleanSessionTestcase},
    {'name': 'sensorValues', 'testcase': _sensorValuesTestcase},
    {'name': 'status', 'testcase': _sensorStatusTestcase},
    {'name': 'actuatorResponse', 'testcase': _actuatorCommandResponseTestcase},
  ];

  _.forEach(staticTestcases, function (staticTestcase) {
    //that._addTestcase(staticTestcase.name, staticTestcase.testcase);
    that.testcases[staticTestcase.name] = staticTestcase.testcase.bind(that);
    that.results[staticTestcase.name] = [];
  });
};

/**
 * sensorValues - verify sensor valueS
 *
 * @param  {object} values
 * @param  {number} time
 */
MqttTestcases.prototype.sensorValues = function (values, time) {
  var that = this;
  var testcaseName, error;

  _.forEach(values, function (v) {
    testcaseName = VALUE_TESTCASE_PREFIX + v.id;
    if (!_.isEqual('function', typeof that.testcases[testcaseName])) {
      error = 'unknown id:' + v.id;
      logger.error(error);
      that.setResults('sensorValues', error, {'id': v.id}, time);
      return true;
    }

    that.testcases[testcaseName](v, time);
  });
};

/**
 * _addMissingSensorsError - add error at result if not tested sensor exists.
 *
 * @param  {string} testcaseName
 * @return {object}              the result of tested testcases
 */
MqttTestcases.prototype._addMissingSensorsError = function (testcaseName) {
  var sensors = database.findAll('sensors');
  var that = this;
  var error;
  var requiredSensorIds;

  if (!sensors) {
    logger.warn('No sensors in gateway');
    return;
  }

  var results = _.cloneDeep(this.results[testcaseName]);

  if (testcaseName === 'status') {
    requiredSensorIds = _.concat(this.gatewayId, _.map(sensors, 'id'));
  }
  else {
    requiredSensorIds = _.map(sensors, 'id');
    //TODO FIXME DELETE ACTUATOR
  }

  var testcasePassedSensors = _.map(results, function (sensor) {
    return sensor.data.id;
  });
  var notTestedSensorIds = _.difference(requiredSensorIds, testcasePassedSensors);

  _.forEach(notTestedSensorIds, function (sensorId) {
    error = util.format('%s not tested', sensorId);
    results.push({'error': error, 'data': {'id': sensorId}, 'time': Date.now()});
  });

  return results;
};

/**
 * getResults - get testcases results
 *
 * @param  {string} testcaseName
 * @return {object}              the result of tested testcases
 */
MqttTestcases.prototype.getResults = function (testcaseName) {
  if (testcaseName) {
    if (testcaseName === 'status') {
      return this._addMissingSensorsError('status');
    }
    else if (testcaseName === 'sensorValues') {
      return this._addMissingSensorsError('sensorValues');
    }
    else {
      return _.cloneDeep(this.results[testcaseName]);
    }
  }
  else {
    var results = _.cloneDeep(this.results);
    results.status = this._addMissingSensorsError('status');
    results.sensorValues = this._addMissingSensorsError('sensorValues');
    return results;
  }
};

/**
 * setResults - set testcase results
 *
 * @param  {string} testcaseName
 * @param  {string} error
 * @param  {object} receivedData
 * @param  {number} time
 */
MqttTestcases.prototype.setResults = function (testcaseName, error, receivedData, time) {
  if (error) {
    logger.error('[%s] verify faied. error:%s', testcaseName, error);
  }
  else {
    logger.info('[%s] pass', testcaseName);
  }

  this.results[testcaseName].push({'error': error, 'data': receivedData, 'time': time});
};

/**
 * cleanHistory - clear testcases results
 *
 */
MqttTestcases.prototype.clearHistory = function  () {
  _.forEach(this.results, function (r) {
    r.length = 0;
  });
};

/**
 * sendActuatorCommands - send every actuators commands
 *
 * @param  {object} testcaseIntance
 */
MqttTestcases.prototype.sendActuatorCommands = function (testcaseIntance) {
  var that = testcaseIntance;
  var sensorTypes = database.findAll('sensorTypes');
  var sensors = database.findAll('sensors');

  if (_.isUndefined(this.sentActuatorCommands)) {
    this.sentActuatorCommands = {};
  }

  var actuators = _.filter(sensors, function (s) {
    return s.category === 'actuator';
  });

  async.eachSeries(actuators, function(actuator, asyncDone) {
    var actuatorType = _.filter(sensorTypes, {'id': actuator.type})[0];
    _sendActuatorCommand.call(that, actuator, actuatorType, asyncDone);
  });
};

module.exports = MqttTestcases;
