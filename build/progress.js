
/*
Copyright 2016 Resin.io

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	 http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
 */
var getProgressStream, noop, progress, rindle, stream, utils, zlib;

noop = require('lodash/noop');

zlib = require('zlib');

stream = require('stream');

progress = require('progress-stream');

rindle = require('rindle');

utils = require('./utils');


/**
 * @module progress
 */


/**
 * @summary Get progress stream
 * @function
 * @private
 *
 * @param {Number} total - response total
 * @param {Function} [onState] - on state callback (state)
 * @returns {Stream} progress stream
 *
 * @example
 * progressStream = getProgressStream response, (state) ->
 * 	console.log(state)
 *
 * return responseStream.pipe(progressStream).pipe(output)
 */

getProgressStream = function(total, onState) {
  var progressStream;
  if (onState == null) {
    onState = noop;
  }
  progressStream = progress({
    time: 500,
    length: total
  });
  progressStream.on('progress', function(state) {
    if (state.length === 0) {
      return onState(void 0);
    }
    return onState({
      total: state.length,
      received: state.transferred,
      eta: state.eta,
      percentage: state.percentage
    });
  });
  return progressStream;
};


/**
 * @summary Make a node request with progress
 * @function
 * @protected
 *
 * @description **Not implemented for the browser.**
 *
 * @param {Object} options - request options
 * @returns {Promise<Stream>} request stream
 *
 * @example
 * progress.estimate(options).then (stream) ->
 *		stream.pipe(fs.createWriteStream('foo/bar'))
 *		stream.on 'progress', (state) ->
 *			console.log(state)
 */

exports.estimate = function(options) {
  options.gzip = false;
  options.headers['Accept-Encoding'] = 'gzip, deflate';
  return utils.requestAsync(options).then(function(response) {
    var gunzip, output, progressStream, responseLength, responseStream, total;
    output = new stream.PassThrough();
    output.response = response;
    responseLength = utils.getResponseLength(response);
    total = responseLength.uncompressed || responseLength.compressed;
    responseStream = response.body;
    progressStream = getProgressStream(total, function(state) {
      return output.emit('progress', state);
    });
    if (utils.isResponseCompressed(response)) {
      gunzip = new zlib.createGunzip();
      if ((responseLength.compressed != null) && (responseLength.uncompressed == null)) {
        responseStream.pipe(progressStream).pipe(gunzip).pipe(output);
      } else {
        responseStream.pipe(gunzip).pipe(progressStream).pipe(output);
      }
    } else {
      responseStream.pipe(progressStream).pipe(output);
    }
    return output;
  });
};
