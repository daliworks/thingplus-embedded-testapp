var _ = require('lodash');
var async = require('async');
var colors = require('colors/safe');
var open = require('open');


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
function report(mqttConnected, receivedMqttMsg, errorMqttMsg, errorIds, mqttTestResult, restTestResult, cb) {
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
  function errorIdsReport(done) {
    report.errorIds = {};
    report.errorIds.result = _.size(errorIds) ? "FAIL" : "PASS";
    report.errorIds.failed = _.size(errorIds);
    report.errorIds.failedHistory = errorIds;

    done();
  }

  /**
   * 
   * 
   * @param {any} done
   */
  function mqttReport(done) {
    report.mqtt = {};
    async.eachOf(mqttTestResult, function (tcHistory, tcName, asyncDone) {
      /**
       * 
       * 
       * @param {any} history
       * @returns
       */
      var failedHistory = _.filter(tcHistory, function (history) {
        return !history.result;
      });

      report.mqtt[tcName] = {};

      if (_.size(tcHistory) === 0) {
        report.mqtt[tcName].result = "N/A";
      }
      else {
        report.mqtt[tcName].result = _.size(failedHistory) ? "FAIL" : "PASS";
      }
      report.mqtt[tcName].checked = _.size(tcHistory);
      report.mqtt[tcName].failed = _.size(failedHistory);
      report.mqtt[tcName].failedHistory = JSON.stringify(failedHistory);

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
    done();
  }

  // START HERE 
  async.series([errorMqttMsgReport, errorIdsReport, mqttReport, restReport, summary, tcReport], cb);

  return;
}

module.exports =  report;
