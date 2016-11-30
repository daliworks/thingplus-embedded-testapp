var _ = require('lodash'),
    async = require('async'),
    colors = require('colors/safe'),
    json2html = require('node-json2html'),
    fs = require('fs'),
    util = require('util');
//var open = require('open');


function html(report) {
  var htmlDocument;
  var transform = {
    "result": [
      {"<>":"h1", "html": report.summary.result},
      {"<>":"div", "html": report.summary.tested + " tested, " + report.summary.passed + " passed, " + report.summary.failed + " failed, " + report.summary.na + " na."},
      {"<>":"br"},
      {"<>":"h4", "html": "mqtt"},
      {"<>":"div", "html": function () {      }},
    ],
  };

  htmlDocument = json2html.transform(report, transform.result);
  _.mapKeys(report.mqtt, function(value, key) {
    if (!_.isObject(value)) {
      return;
    }

    var t = {"<>":"div", "html": function () {return util.format('- %s : %s', key, value.result) }};
    htmlDocument += json2html.transform(report, t);

    if (value.result === 'FAIL') {
      t = {"<>":"div", "html": function () {return util.format('--- %s', JSON.stringify(value.failedHistory)) }};
      htmlDocument += json2html.transform(null, t);
    }
  });

  console.log(htmlDocument);
  //TODO FIXME
  fs.writeFileSync('report.html', htmlDocument, 'utf8');
}

/**
 * 
 * 
 * @param {any} mqttConnected
 * @param {any} receivedMqttMsg
 * @param {any} errorMqttMsg
 * @param {any} errorIds
 * @param {any} mqttTestResult
 * @param {any} cb
 * @returns
 */
function report(receivedMqttMsg, errorMqttMsg, mqttTestResult, restTestResult, cb) {
  var report = {};

  /**
   * 
   * 
   * @param {any} done
   */
  function errorMqttMsgReport(done) {
    report.mqttMessage = {};

    report.mqttMessage.checked = _.size(receivedMqttMsg);
    report.mqttMessage.result = _.size(errorMqttMsg) ? "FAIL" : "PASS";
    report.mqttMessage.failed = _.size(errorMqttMsg);
    report.mqttMessage.failedHistory = errorMqttMsg;

    done();
  }

  /**
   * 
   * 
   * @param {any} done
   */
  function mqttReport(done) {
    report.mqtt = {};
    async.eachOf(mqttTestResult, function (results, testcaseName, asyncDone) {

      report.mqtt[testcaseName] = {};
      report.mqtt[testcaseName].checked = _.size(results);
      report.mqtt[testcaseName].failedHistory = _.filter(results, function (r) {
        return r.error;
      });

      report.mqtt[testcaseName].failed = _.size(report.mqtt[testcaseName].failedHistory);
      if (report.mqtt[testcaseName].checked === 0) {
        report.mqtt[testcaseName].result = 'N/A';
      }
      else if (report.mqtt[testcaseName].failed) {
        report.mqtt[testcaseName].result = 'FAIL';
      }
      else {
        report.mqtt[testcaseName].result = 'PASS';
      }
      asyncDone();
    },
    function mqttTcSummary(err) {
      report.mqtt.tested = _.size(report.mqtt);
      report.mqtt.failed = _.size(_.filter(report.mqtt, function(tc) {
        return tc.result === 'FAIL';
      }));
      report.mqtt.na = _.size(_.filter(report.mqtt, function(tc) {
        return tc.result === 'N/A';
      }));
      report.mqtt.passed = _.size(_.filter(report.mqtt, function(tc) {
        return tc.result === 'PASS';
      }));

      report.mqtt.result = report.mqtt.tested === report.mqtt.passed ? "PASS" : "FAIL";

      done();
    });
  }

  function restReport(done) {

    report.rest = restTestResult;
    console.log(restTestResult);

    return done();
  }

  /**
   * 
   * 
   * @param {any} done
   */
  function summary(done) {
    report.summary = {};

    report.summary.tested = report.mqtt.tested;
    report.summary.passed = report.mqtt.passed;
    report.summary.failed = report.mqtt.failed;
    report.summary.na = report.mqtt.na;

    report.summary.result = 'PASS';
    _.forEach(report, function (r) {
      if (r.result && r.result !== 'PASS') {
        report.summary.result = 'FAIL';
      }
    });

    done();
  }

  /**
   * 
   * 
   * @param {any} done
   */
  function tcReport(done) {
    console.log(report);

html(report);
    done();
  }



  // START HERE 
  async.series([errorMqttMsgReport, mqttReport, restReport, summary, tcReport], cb);

  return;
}

module.exports =  report;

