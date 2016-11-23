var express = require('express'),
    router = express.Router(),
    _ = require('lodash'),
    logger = require('log4js').getLogger('HTTP');

var utils = require('../utils'),
    db = require('../../lib/db');

/**
 * retrieve item from database
 * 
 * @param {string} dbType
 * @returns http response
 */
function getItem(dbType) {
  return function (req, res) {
    var ownerId = req.params.owner,
        id = req.params.id,
        ownerItem, resultItem;

    if (ownerId) {
      ownerItem = db.findOne('gateways', ownerId);

      if (!ownerItem) {
        logger.warn('[getItem] gateways:%s not found', ownerId);
        return res.status(404).send({error: 'gateways:' + ownerId +  ' is not found'});        
      }
    }

    resultItem = db.findOne(dbType, id);

    if (_.isUndefined(resultItem)) {
      logger.warn('[getitem] %s:%s not found', dbType, id);
      return res.status(404).send({error: dbType +  ':' + id + ' is not found'});
    } else {

      if (ownerId && ownerId != resultItem.owner) {
        return res.status(404).send({
          error: dbType + ':' + id + ' not match owner. ownerId= ' + ownerId + ', item owner=' + resultItem.owner
        });
      }

      return res.status(200).send(utils.processQuery(resultItem, req.query));
    }  

  };
}

/**
 * retrieve collection from database
 * 
 * @param {string} dbType
 * @returns
 */
function getCollection(dbType) {
  return function (req, res) {
    var ownerId = req.params.owner,
        ownerItem, items, resultItems;

    if (ownerId) {
      ownerItem = db.findOne('gateways', ownerId);

      if (!ownerItem) {
        logger.warn('[getCollection] gateways:%s not found', ownerId);
        return res.status(404).send({error: 'gateways:' + ownerId +  ' is not found'});        
      }
    }

    items = db.findAll(dbType);


    if (_.isUndefined(items)) {
      logger.warn('[getCollection] %s not found', dbType);
      return res.status(404).send({error: dbType + ' is not found'});
    } else {

      if (ownerId) {
        resultItems = _.filter(items, { owner : ownerId});  
      } else {
        resultItems = items;
      }

      return res.status(200).send(utils.processQuery(resultItems, req.query));
    }  
  };
}

/**
 * check validation and insert into database
 * 
 * @param {string} dbType
 * @returns
 */
function postItem(dbType) {
  return function (req, res) {
    var ownerId = req.params.owner,
        item = req.body,
        tcRest = req.app.locals.tcRest,
        ownerItem, tcFunc;

    if (ownerId) {
      ownerItem = db.findOne('gateways', ownerId);

      if (!ownerItem) {
        logger.warn('[getCollection] gateways:%s not found', ownerId);
        return res.status(404).send({error: 'gateways:' + ownerId +  ' is not found'});        
      }
    }

    if (dbType === 'devices') {
      tcFunc = tcRest.devicePost;
    } else if (dbType === 'sensors') {
      tcFunc = tcRest.sensorPost;
    }

    tcFunc(tcRest, ownerItem, item, Date.now(), function (err, result) {
      if (err) {
        return res.status(400).send({error: err}); 
      }

      // rename reqId to id
      result.id = result.reqId;
      delete result.reqid;

      // result id insert into 'gateways'
      ownerItem[dbType].push(result.id);
      db.updateOne('gateways', ownerId, ownerItem);

      // insert into dbTypes(devices or sensors)
      // set owner 
      // set ctime if ctime is empty
      result.owner = ownerId;
      if (!result.ctime) {
        result.ctime = Date.now().toString();
      }
      db.insertOne(dbType, result);

      return res.status(201).send(result);
    });

  };
}


router.get('/', getCollection('gateways'));
router.get('/:id', getItem('gateways'));

router.get('/:owner/devices', getCollection('devices'));
router.get('/:owner/devices/:id', getItem('devices'));
router.post('/:owner/devices', postItem('devices'));

router.get('/:owner/sensors', getCollection('sensors'));
router.get('/:owner/sensors/:id', getItem('sensors'));
router.post('/:owner/sensors', postItem('sensors'));


module.exports = router;