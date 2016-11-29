var fs = require('fs'),
    logger = require('log4js').getLogger('FIXTURE:CONFIG');

var CONFIG_FILE = '../config.json';

function loadConfig() {
  var config, file;

  if (!fs.existsSync(CONFIG_FILE)) {
    logger.error('[loadConfig] file not found. ', CONFIG_FILE);
    return undefined;
  }

  try {
    file = fs.readFileSync(CONFIG_FILE, 'utf8');
    config = JSON.parse(file);

    logger.info('[loadConfig] config loading file success. config=', JSON.stringify(config));
  }
  catch (e) {
    logger.error('[loadConfig] config json pasing failed. error=', e);
    // throw e;
  }
  config.gateway.model = '29';

  return config;
}


module.exports = loadConfig();


