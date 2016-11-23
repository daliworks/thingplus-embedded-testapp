var express = require('express'),
    router = express.Router(),
    _ = require('lodash'),
    logger = require('log4js').getLogger('HTTP');

var utils = require('../utils'),
    db = require('../../lib/db');

router.get('/', function(req, res, next) {
  var dataKey = _.replace(req.baseUrl, '/', ''),
      items;

  items = db.findAll(dataKey);

  if (_.isUndefined(items)) {
    logger.warn('[staticData/get] %s is undefined', dataKey);

    res.status(404).send({error: dataKey + ' is undefined'});
  } else {
    res.status(200).send(utils.processQuery(items, req.query));
  }
});

router.get('/:id', function(req, res, next) {
  var dataKey = _.replace(req.baseUrl, '/', ''),
      dataId = req.params.id,
      item;

  item = db.findOne(dataKey, dataId);

  if (_.isUndefined(item)) {
    logger.warn('[staticData/get:id] %s:%s is undefined', dataKey, dataId);

    res.status(404).send({error: dataKey + ':' + dataId +  ' is undefined'});
  } else {
    res.status(200).send(utils.processQuery(item, req.query));
  }  
});

module.exports = router;