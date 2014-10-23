'use strict';
/*
 * RESP.js
 * https://github.com/teambition/merge2
 *
 * Copyright (c) 2014 Yan Qing
 * Licensed under the MIT license.
 */

var util = require('util');
var Stream = require('stream');
var CRLF = '\r\n';

exports.stringify = stringify;
exports.Resp = Resp;

exports.parse = function (str, returnBuffers) {
  var result = parseBuffer(new Buffer(str), 0, returnBuffers);
  if (!result) return null;
  if (result instanceof Error) throw result;
  return result.content;
};

function stringify(val) {
  var str = '';
  if (val == null || val !== val) return '$-1' + CRLF;

  switch (typeof val) {
    case 'boolean':
      return ':' + (+val) + CRLF;
    case 'number':
      return ':' + val + CRLF;
    case 'string':
      return '$' + val.length + CRLF + val + CRLF;
  }

  if (util.isArray(val)) {
    str = '*' + val.length + CRLF;
    for (var i = 0, l = val.length; i < l; i++) str += stringify(val[i]);
    return str;
  }

  if (util.isBuffer(val)) {
    str = val.utf8Slice(0, val.length);
    return '$' + str.length + CRLF + str + CRLF;
  }

  if (util.isError(val)) return '-' + val.name + ' ' + val.message + CRLF;

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
      if (!result.content.length) return new Error('Invalid Chunk: parse "-" fail');
      result.content = new Error(result.content);
      return result;

    case 58:  // ':'
      result.content = +(result.content);
      if (result.content !== result.content) return new Error('Invalid Chunk: parse ":" fail');
      return result;

    case 36:  // '$'
      len = +(result.content);
      if (!result.content.length || len !== len) return new Error('Invalid Chunk: parse "$" fail, invalid length');
      if (len === -1) result.content = returnBuffers ? new Buffer(0) : null;
      else if (!isCRLF(buffer, result.index + len)) return new Error('Invalid Chunk: parse "$" fail, invalid CRLF');
      else {
        result.content = buffer[returnBuffers ? 'slice' : 'utf8Slice'](result.index, result.index + len);
        result.index = result.index + len + 2;
      }
      return result;

    case 42:  // '*'
      len = +(result.content);
      if (!result.content.length || len !== len) return new Error('Invalid Chunk: parse "*" fail, invalid length');
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

  if (options.objectMode !== false) options.objectMode = true;

  Stream.Readable.call(this, options);

  this._expectResCount = options.expectResCount > 0 ? +options.expectResCount : Number.MAX_VALUE;
  this._returnBuffers = !options.objectMode;
  this._resCount = 0;
  this._index = 0;
  this._buffer = null;
}
util.inherits(Resp, Stream.Readable);

Resp.prototype.feed = function (buffer) {
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
    var result = parseBuffer(this._buffer, this._index, this._returnBuffers);
    if (result == null) return this.emit('wait');
    if (result instanceof Error) {
      this._index = 0;
      this._buffer = null;
      return this.emit('error', result);
    }
    this._index = result.index;
    this.push(result.content);
    if (++this._resCount >= this._expectResCount) {
      if (this._index < this._buffer.length) this.emit('error', new Error('Data surplus'));
      return this.push(null);
    }
  }
  this._index = 0;
  this._buffer = null;
  return this.emit('wait');
};

Resp.prototype._read = function() {};
