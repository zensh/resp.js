'use strict';
/*
 * RESP.js
 * https://github.com/zensh/resp.js
 *
 * Copyright (c) 2014 Yan Qing
 * Licensed under the MIT license.
 */

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var CRLF = '\r\n';

exports.Resp = Resp;

exports.parse = function(string, returnBuffers) {
  var buffer = new Buffer(string);
  var result = parseBuffer(buffer, 0, returnBuffers);
  if (!result || result.index < buffer.length) throw new RespError('Parse "' + string + '" fail');
  if (result instanceof Error) throw result;
  return result.content;
};

exports.stringify = function(value, forceBulkStrings) {
  var str = stringify(value, forceBulkStrings);
  if (!str) throw new RespError('Invalid value: ' + value);
  return str;
};

exports.bufferify = function(value) {
  var buffer = bufferify(value);
  if (!buffer) throw new RespError('Invalid value: ' + value);
  return buffer;
};

function Resp(options) {
  if (!(this instanceof Resp)) return new Resp(options);
  options = options || {};
  this._respState = new RespState(options);
  this.setAutoEnd(options.expectResCount);
  EventEmitter.call(this);
}
util.inherits(Resp, EventEmitter);

Resp.prototype.feed = function(buffer) {
  var state = this._respState;
  if (state.ended) return this.emit('error', new RespError('The resp was ended'));
  if (!buffer) return this.end();
  if (!Buffer.isBuffer(buffer)) return this.emit('error', new RespError('Invalid buffer chunk'));

  if (!state.buffer) state.buffer = buffer;
  else {
    var ret = state.buffer.length - state.index;
    var concatBuffer = new Buffer(buffer.length + ret);

    state.buffer.copy(concatBuffer, 0, state.index);
    buffer.copy(concatBuffer, ret);
    state.buffer = concatBuffer;
    state.index = 0;
  }

  while (state.index < state.buffer.length) {
    var result = parseBuffer(state.buffer, state.index, state.returnBuffers);
    if (result == null) return this.emit('wait');
    state.resCount++;
    if (result instanceof Error) {
      this.emit('error', result);
      clearState(this);
      if (state.resCount >= state.expectResCount) this.end();
      return;
    }
    state.index = result.index;
    this.emit('data', result.content);
    if (state.resCount >= state.expectResCount) {
      if (state.index < state.buffer.length) this.emit('error', new RespError('Data surplus'));
      clearState(this);
      return this.end();
    }
  }

  clearState(this);
  return this.emit('wait');
};

Resp.prototype.setAutoEnd = function(resCount) {
  var state = this._respState;
  if (resCount >= 1) state.expectResCount = state.resCount + resCount; // limited Mode
  else state.expectResCount = Number.MAX_VALUE; // infinite Mode
};

Resp.prototype.end = function(chunk) {
  if (chunk && Buffer.isBuffer(chunk)) this.feed(chunk);
  if (this._respState.ended) return;
  this._respState.ended = true;
  this.emit('end');
};

function stringify(val, forceBulkStrings) {
  var str = '', _str = null;
  if (val == null || val !== val) return '$-1' + CRLF;

  var type = typeof val;

  if (forceBulkStrings && type !== 'object') {
    val = val + '';
    return '$' + Buffer.byteLength(val, 'utf8') + CRLF + val + CRLF;
  }

  switch (type) {
    case 'string':
      return '+' + val + CRLF;
    case 'boolean':
      return ':' + (+val) + CRLF;
    case 'number':
      return ':' + val + CRLF;
  }

  if (util.isError(val)) return '-' + val.name + ': ' + val.message + CRLF;

  if (util.isArray(val)) {
    str = '*' + val.length + CRLF;
    for (var i = 0, len = val.length; i < len; i++) {
      _str = stringify(val[i], forceBulkStrings);
      if (!_str) return false;
      str += _str;
    }
    return str;
  }

  return false;
}

function bufferify(val) {
  var index, buffer;
  var str = stringify(val, true);

  if (str) return new Buffer(str);
  if (Buffer.isBuffer(val)) {
    str = '$' + val.length + CRLF;
    buffer = new Buffer(str.length + val.length + 2);
    buffer.write(str);
    val.copy(buffer, str.length);
    buffer.write(CRLF, str.length + val.length);
    return buffer;
  }
  if (!Array.isArray(val)) return false;

  str = '*' + val.length + CRLF;
  index = str.length;
  buffer = new Buffer(Math.max(val.length, 1024) * 8);
  buffer.write(str, 0);

  for (var i = 0, len = val.length; i < len; i++) {
    var subBuffer = bufferify(val[i]);
    if (!subBuffer) return false;
    if (subBuffer.length <= buffer.length - index) {
      subBuffer.copy(buffer, index);
      index += subBuffer.length;
    } else {
      var concatBuffer = new Buffer(index + subBuffer.length);
      buffer.copy(concatBuffer, 0, 0, index);
      subBuffer.copy(concatBuffer, index);
      buffer = concatBuffer;
      index = buffer.length;
    }
  }
  return buffer.slice(0, index);
}

function readBuffer(buffer, index) {
  var start = index;
  while (index < buffer.length && !isCRLF(buffer, index)) index++;

  return index >= buffer.length ? null : {
    content: buffer.utf8Slice(start, index),
    index: index + 2
  };
}

function parseBuffer(buffer, index, returnBuffers) {
  var len = NaN;
  var result = readBuffer(buffer, index + 1);
  if (result == null) return result;

  switch (buffer[index]) {
    case 43: // '+'
      return result;

    case 45: // '-'
      if (!result.content.length) return new RespError('Parse "-" fail');
      result.content = new RespError(result.content);
      return result;

    case 58: // ':'
      result.content = +(result.content);
      if (result.content !== result.content) return new RespError('Parse ":" fail');
      return result;

    case 36: // '$'
      len = +(result.content);
      if (!result.content.length || len !== len) return new RespError('Parse "$" fail, invalid length');
      if (len === -1) result.content = null;
      else if (buffer.length < result.index + len + 2) return null;
      else if (!isCRLF(buffer, result.index + len)) return new RespError('Parse "$" fail, invalid CRLF');
      else {
        result.content = buffer[returnBuffers ? 'slice' : 'utf8Slice'](result.index, result.index + len);
        result.index = result.index + len + 2;
      }
      return result;

    case 42: // '*'
      len = +(result.content);
      if (!result.content.length || len !== len) return new RespError('Parse "*" fail, invalid length');
      if (len === -1) result.content = null;
      else if (len === 0) result.content = [];
      else {
        result.content = Array(len);
        for (var i = 0; i < len; i++) {
          var _result = parseBuffer(buffer, result.index);
          if (_result == null) return _result;
          if (_result instanceof Error) return _result;
          result.content[i] = _result.content;
          result.index = _result.index;
        }
      }
      return result;
  }

  return new RespError('Invalid Chunk: parse fail');
}

function RespState(options) {
  this.index = 0;
  this.buffer = null;
  this.ended = false;
  this.resCount = 0;
  this.expectResCount = 1;
  this.returnBuffers = !!options.returnBuffers;
}

function clearState(ctx) {
  ctx._respState.index = 0;
  ctx._respState.buffer = null;
}

function isCRLF(buffer, index) {
  return buffer[index] === 13 && buffer[index + 1] === 10;
}

function RespError(message) {
  Error.captureStackTrace(this, this.constructor);
  this.message = message;
}
util.inherits(RespError, Error);
RespError.prototype.name = 'RespError';
