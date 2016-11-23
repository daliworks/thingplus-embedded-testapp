#!/usr/bin/env node
'use strict';

var express = require('express'),
    path = require('path'),
    favicon = require('serve-favicon'),
    bodyParser = require('body-parser'),
    compression = require('compression'),
    log4js = require('log4js'),
    logger = log4js.getLogger('HTTP');

var index = require('./routes/index'),
    gateways = require('./routes/gateways'),
    staticData = require('./routes/staticData');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// response compression
app.use(compression());

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(log4js.connectLogger(logger, { level: 'auto', format: ':method :url :status' }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static(path.join(__dirname, 'public')));

// check auth
app.use(function (req, res, next) {
  logger.info('check auth');
  next();
});

app.use('/', index);

app.use('/gateways', gateways);

app.use(['/gatewayModels', '/sensorTypes', '/sensorDrivers'], staticData);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
