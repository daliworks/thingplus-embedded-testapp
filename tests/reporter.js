var _ = require('lodash');
var assert = require('chai').assert;
var reporter = require('../reporter.js');

function mqttParsingErr() {
  var messages = [
    {'topic': 'v/a/g/dddd', 'payload': 'asdfasdf', 'reason': 'parsing error', 'time': new Date().getTime()},
    {'topic': 'v/a/g/asdf', 'payload': 'r1', 'reason': 'unknown topic', 'time': new Date().getTime()}
  ];

  return messages;
}

function mqttMessage() {
  var messages = [
    {'topic': 'v/a/g/dddd', 'payload': 'asdfasdf', 'reason': 'parsing error', 'time': new Date().getTime()},
    {'topic': 'v/a/g/dddd', 'payload': 'asdfasdf', 'reason': 'parsing error', 'time': new Date().getTime()},
    {'topic': 'v/a/g/dddd', 'payload': 'asdfasdf', 'reason': 'parsing error', 'time': new Date().getTime()},
    {'topic': 'v/a/g/dddd', 'payload': 'asdfasdf', 'reason': 'parsing error', 'time': new Date().getTime()},
    {'topic': 'v/a/g/asdf', 'payload': 'r1', 'reason': 'unknown topic', 'time': new Date().getTime()}
  ];

  return messages;
}

function mqttErrHistory() {
  return { 
    'tcStatus': [ 
      { 'result': true, 'time': 'Tue Nov 01 2016 18:35:09 GMT+0900 (KST)' },
      { 'result': false,
        'reason': 'VALUE ERROR(offfffod)',
        'time': 'Tue Nov 01 2016 18:35:09 GMT+0900 (KST)'},
      { 'result': false,
        'reason': 'TIMEOUT ERROR(19393dd83kd83&&)',
        'time': 'Tue Nov 01 2016 18:35:09 GMT+0900 (KST)' },
      { 'result': true, 'time': 'Tue Nov 01 2016 18:35:09 GMT+0900 (KST)' },
      { 'result': true, 'time': 'Tue Nov 01 2016 18:35:09 GMT+0900 (KST)' }],
    'tcSensorValue': [ 
      { 'result': true, 'time': 'Tue Nov 01 2016 18:35:09 GMT+0900 (KST)' },
      { 'result': true, 'time': 'Tue Nov 01 2016 18:35:09 GMT+0900 (KST)' }],
    'tcGatewayId': [ 
      { 'result': true, 'time': 'Tue Nov 01 2016 18:35:09 GMT+0900 (KST)' },
      { 'result': false,
        'reason': 'expect:012345012345, actual:asdf',
        'time': 'Tue Nov 01 2016 18:35:09 GMT+0900 (KST)' },
      { 'result': true, 'time': 'Tue Nov 01 2016 18:35:09 GMT+0900 (KST)' },
      { 'result': false,
        'reason': 'expect:012345012345, actual:wrongId',
        'time': 'Tue Nov 01 2016 18:35:09 GMT+0900 (KST)' } ],
    'tcApikey': [],
    'tcCleanSession': [],
    'tcKeepalive': [] };
}

function mqttSuccessHistory() {
  return { 
    'tcStatus': [ 
      { 'result': true, 'time': 'Tue Nov 01 2016 18:35:09 GMT+0900 (KST)' },
      { 'result': true, 'time': 'Tue Nov 01 2016 18:35:09 GMT+0900 (KST)' },
      { 'result': true, 'time': 'Tue Nov 01 2016 18:35:09 GMT+0900 (KST)' },
      { 'result': true, 'time': 'Tue Nov 01 2016 18:35:09 GMT+0900 (KST)' },
      { 'result': true, 'time': 'Tue Nov 01 2016 18:35:09 GMT+0900 (KST)' },
      { 'result': true, 'time': 'Tue Nov 01 2016 18:35:09 GMT+0900 (KST)' }],
    'tcSensorValue': [ 
      { 'result': true, 'time': 'Tue Nov 01 2016 18:35:09 GMT+0900 (KST)' },
      { 'result': true, 'time': 'Tue Nov 01 2016 18:35:09 GMT+0900 (KST)' }],
    'tcGatewayId': [ 
      { 'result': true, 'time': 'Tue Nov 01 2016 18:35:09 GMT+0900 (KST)' },
      { 'result': true, 'time': 'Tue Nov 01 2016 18:35:09 GMT+0900 (KST)' }]
  };
}

function errorIds() {
  return [{'id': 'asdfasdf', 'time' : 'Tue Nov 01 2016 18:35:09 GMT+0900 (KST)', 'raw': null}];
};

describe('[REPORT]', function () {
  it ('success', function (done) {
    reporter(mqttErrHistory(), errorIds(), mqttMessage(), mqttParsingErr(), done);
  });

  it ('All Message Parsed', function (done) {
    reporter(mqttSuccessHistory(), null, mqttMessage(), null, done);
  });
});
