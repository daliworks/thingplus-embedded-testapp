var _ = require('lodash');
var async = require('async');
var colors = require('colors/safe');

function report(mqttHistory, errorIds, receivedMqttMsg, errorMqttMsg, cb) {
  var result = true;
  var passed = 0;
  var failed = 0;
  var notTested = 0;
  var checked = 0;

  function errorMqttMsgReport(done) {
    if (_.size(errorMqttMsg)) {
      console.log(colors.red('[ERROR MQTT MSG] (' + _.size(receivedMqttMsg) + ' received, ' + _.size(errorMqttMsg) + ' failed)'));
      _.forEach(errorMqttMsg, function (message) {
        result = false;

        console.log('\t' + JSON.stringify(message));
      });
    }
    else {
      console.log(colors.green('[PARSED MESSAGE] '+ _.size(receivedMqttMsg)));
    }
    done();
  }

  function errorIdsReport(done) {
    if (_.size(errorIds)) {
      console.log(colors.red('[ERROR GW ID OR SENDOR ID] (' + _.size(errorIds) + ' recieved)'));
      _.forEach(errorIds, function (id){
        console.log('\t' + JSON.stringify(id));
      });
    }
    done();
  }

  function tcMqttReport(done) {
    async.eachOfSeries(mqttHistory, function (tcHistory, tcName, asyncDone) {
      if (_.size(tcHistory) === 0) {
        result = false;
        notTested++;
        console.log(colors.gray('[N/A] "' + tcName + '"'));
        return asyncDone();
      }

      var failedHistory = _.filter(tcHistory, function (history) {
        return !history.result;
      });

      if (_.size(failedHistory) === 0 ){ 
        console.log(colors.green('[PASS] "' + tcName + '" (' + _.size(tcHistory) + ' checks)'));
        passed++;
        checked += _.size(tcHistory);
      }
      else {
        result = false;
        failed++;
        console.log(colors.red('[FAIL] "' + tcName + '" (' + _.size(tcHistory) + ' checks, ' + _.size(failedHistory) +' failed)'));
        _.forEach(failedHistory, function (h) {
          console.log('\t' + JSON.stringify(h));
        });
      }

      asyncDone();
    },
    function (err) {
      done();
    }
    );
  }

  function tcReport(done) {
    console.log('\n');
    if (result) {
      console.log(colors.green('[TEST SUCCESS] (' + _.size(mqttHistory) + ' tested, '+ checked +' checks)'));
    }
    else {
      console.log(colors.red('[TEST FAILED] ' + passed + ' tested, ' + failed + ' fails, ' + notTested +' n/a, ' + _.size(errorMqttMsg) + ' error_messages, ' + _.size(errorIds) + ' error_id'));
    }
    done();
  }

  // START HERE 
  async.series([errorMqttMsgReport, errorIdsReport, tcMqttReport, tcReport],
    cb);
  return;
}

module.exports =  report
