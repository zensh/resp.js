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

exports.stringify = stringify;
exports.Resp = Resp;

exports.parse = function (str, returnBuffers) {
  var buffer = new Buffer(str);
  var result = parseBuffer(buffer, 0, returnBuffers);
  if (!result || result.index < buffer.length) throw new Error('Parse "' + str + '" fail');
  if (result instanceof Error) throw result;
  return result.content;
};

function stringify(val, forceBulkStrings) {
  var str = '';
  if (val == null || val !== val) return '$-1' + CRLF;

  switch (typeof val) {
    case 'boolean':
      return ':' + (+val) + CRLF;
    case 'number':
      if (forceBulkStrings) return '$' + Buffer.byteLength(val + '', 'utf8') + CRLF + val + CRLF;
      return ':' + val + CRLF;
    case 'string':
      if (!forceBulkStrings && val.indexOf('\r') < 0 && val.indexOf('\n') < 0) return '+' + val + CRLF;
      return '$' + Buffer.byteLength(val, 'utf8') + CRLF + val + CRLF;
  }

  if (util.isArray(val)) {
    str = '*' + val.length + CRLF;
    for (var i = 0, l = val.length; i < l; i++) str += stringify(val[i], forceBulkStrings);
    return str;
  }

  if (Buffer.isBuffer(val)) return '$' + val.length + CRLF + val.toString() + CRLF;
  if (util.isError(val)) return '-' + val.name + ': ' + val.message + CRLF;

  throw new Error('Invalid value: ' + val);
}

function isCRLF(buffer, index) {
  return buffer[index] === 13 && buffer[index + 1] === 10;
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
    case 43:  // '+'
      return result;

    case 45:  // '-'
      if (!result.content.length) return new Error('Parse "-" fail');
      result.content = new Error(result.content);
      return result;

    case 58:  // ':'
      result.content = +(result.content);
      if (result.content !== result.content) return new Error('Parse ":" fail');
      return result;

    case 36:  // '$'
      len = +(result.content);
      if (!result.content.length || len !== len) return new Error('Parse "$" fail, invalid length');
      if (len === -1) result.content = returnBuffers ? new Buffer(0) : null;
      else if (!isCRLF(buffer, result.index + len)) return new Error('Parse "$" fail, invalid CRLF');
      else {
        result.content = buffer[returnBuffers ? 'slice' : 'utf8Slice'](result.index, result.index + len);
        result.index = result.index + len + 2;
      }
      return result;

    case 42:  // '*'
      len = +(result.content);
      if (!result.content.length || len !== len) return new Error('Parse "*" fail, invalid length');
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

  return new Error('Invalid Chunk: parse fail');
}

function Resp(options) {
  if (!(this instanceof Resp)) return new Resp(options);

  EventEmitter.call(this);

  this.options = options || {};
  this._resCount = 0;
  this._index = 0;
  this._buffer = null;
  this.options.expectResCount = this.options.expectResCount >= 1 ? +this.options.expectResCount : Number.MAX_VALUE;
}
util.inherits(Resp, EventEmitter);

Resp.prototype.feed = function (buffer) {
  var returnBuffers = this.options.returnBuffers;
  var expectResCount = +this.options.expectResCount;
  if (!buffer) return this.emit('end');
  if (!Buffer.isBuffer(buffer)) return this.emit('error', new TypeError('Invalid buffer chunk'));

  if (!this._buffer) this._buffer = buffer;
  else {
    var ret = this._buffer.length - this._index;
    var _buffer = new Buffer(buffer.length + ret);

    this._buffer.copy(_buffer, 0, this._index);
    buffer.copy(_buffer, ret);
    this._buffer = _buffer;
    this._index = 0;
  }

  while (this._index < this._buffer.length) {
    var result = parseBuffer(this._buffer, this._index, returnBuffers);
    if (result == null) return this.emit('wait');
    this._resCount++;
    if (result instanceof Error) {
      this.emit('error', result);
      clearState(this);
      if (this._resCount >= expectResCount) this.emit('end');
      return;
    }
    this._index = result.index;
    if (returnBuffers && !Buffer.isBuffer(result.content)) result.content = new Buffer(result.content + '');
    this.emit('data', result.content);
    if (this._resCount >= expectResCount) {
      if (this._index < this._buffer.length) this.emit('error', new Error('Data surplus'));
      clearState(this);
      return this.emit('end');
    }
  }
  clearState(this);
  return this.emit('wait');
};

function clearState(ctx) {
  ctx._index = 0;
  ctx._buffer = null;
}
