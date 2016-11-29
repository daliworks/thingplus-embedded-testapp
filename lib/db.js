var _ = require('lodash'),
    path = require('path'),
    fs = require('fs'),
    logger = require('log4js').getLogger('DB');

var initialized = false;

var collections = {
  gateways: [],
  devices: [],
  sensors: [],
  gatewayModels: [],
  sensorTypes: [],
  sensorDrivers: []
};

var database = {};

/**
 * database initailize
 */
database.init = function () {
  var basePath = path.join(__dirname, './data'),
      dataFiles = ['gatewayModels', 'sensorTypes', 'sensorDrivers'];

  if (!initialized) {
    _.forOwn(dataFiles, function (file) {
      var fileData, filePath = path.join(basePath, file + '.json');
      if (fs.existsSync(filePath)) {
        fileData = fs.readFileSync(filePath, 'utf8');
        try {
          collections[file] = JSON.parse(fileData);
          logger.info('[init] loading done. data=%s, file=%s', file, filePath);
        } catch (e) {
          logger.error('[init] json parsing failed. file=', filePath, ', error=', e);
        }
      } else {
        logger.error('[init] not found data file. path=', filePath);
      }
    });

    initialized = true;
  }
};

/**
 * returns one item that matching id
 * 
 * @param {string} key
 * @param {string} id
 * @returns
 */
database.findOne = function (key, id) {
  return _.cloneDeep(_.find(collections[key], { 'id': id }));
};

/**
 * returns all items
 * 
 * @param {string} key
 * @returns
 */
database.findAll = function (key) {
  return _.cloneDeep(collections[key]);
};

/**
 * insert a item into a collection
 * 
 * @param {string} key
 * @param {object} item
 * @returns
 */
database.insertOne = function (key, item) {
  if (!collections[key]) {
    logger.error('[insertOne] invalid collection key. key=%s, item=', key, item);
    return;
  }

  if (!item.id) {
    logger.error('[insertOne] undefined item id. key=%s, item=', key, item);
    return;
  }

  if (this.findOne(key, item.id)) {
    logger.error('[insertOne] duplicated item id. key=%s, item=', key, item);
    return;
  }

  collections[key].push(item);

  logger.info('[insertOne] success. key=%s, item=', key, item);
  return _.cloneDeep(item);
};

/**
 * insert multiple items into a collection
 * 
 * @param {string} key
 * @param {array} items
 */
database.insertMany = function (key, items) {
  var rtnItems = [];
  _.forEach(items, function (item) {
    var result;
    result = database.insertOne(key, item);
    if (result) {
      rtnItems.push(result);
    }
  });

  return rtnItems;
};

/**
 * updates a single item within the collections
 * 
 * @param {string} key
 * @param {string} id
 * @param {object} item
 */
database.updateOne = function (key, id, item) {
  var preItem, newItem, index;

  index = _.findIndex(collections[key], {'id': id});

  if (index === -1) {
    logger.error('[updateOne] %s:%s item is not found', key, id);
    return;
  }

  preItem = collections[key][index];
  newItem = _.assign(preItem, item);

  logger.info('[updateOne] success. newItem=', newItem);

  return _.cloneDeep(newItem);
};

/**
 * removes item from a collection
 * 
 * @param {string} key
 * @param {string} id
 */
database.remove = function (key, id) {
  // NOT IMPLEMENTED
};


module.exports = database;
