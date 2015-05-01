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

module.exports = Resp;

Resp.parse = function(string, returnBuffers) {
  var buffer = new Buffer(string);
  var result = parseBuffer(buffer, 0, returnBuffers);
  if (!result || result.index < buffer.length) throw new Error('Parse "' + string + '" failed');
  if (result instanceof Error) throw result;
  return result.content;
};

Resp.stringify = function(value, forceBulkStrings) {
  var str = stringify(value, forceBulkStrings);
  if (!str) throw new Error('Invalid value: ' + JSON.stringify(value));
  return str;
};

Resp.bufferify = function(value) {
  var buffer = bufferify(value);
  if (!buffer) throw new Error('Invalid value: ' + JSON.stringify(value));
  return buffer;
};

function Resp(options) {
  if (!(this instanceof Resp)) return new Resp(options);
  options = options || {};
  this._returnBuffers = !!options.returnBuffers;

  // legacy from old stream.
  this.writable = true;
  clearState(this);
  EventEmitter.call(this);
}
util.inherits(Resp, EventEmitter);

Resp.prototype.write = function(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    this.emit('error', new Error('Invalid buffer chunk'));
    return true;
  }

  if (!this._buffer) this._buffer = buffer;
  else {
    var ret = this._buffer.length - this._index;
    var concatBuffer = new Buffer(buffer.length + ret);

    this._buffer.copy(concatBuffer, 0, this._index);
    buffer.copy(concatBuffer, ret);
    this._buffer = concatBuffer;
    this._index = 0;
  }

  while (this._index < this._buffer.length) {
    var result = parseBuffer(this._buffer, this._index, this._returnBuffers);
    if (result == null) {
      this.emit('drain');
      return true;
    }
    if (result instanceof Error) {
      clearState(this);
      this.emit('error', result);
      return false;
    }
    this._index = result.index;
    this.emit('data', result.content);
  }

  clearState(this).emit('drain');
  return true;
};

Resp.prototype.end = function(chunk) {
  if (chunk) this.write(chunk);
  this.emit('finish');
};

function clearState(ctx) {
  ctx._index = 0;
  ctx._buffer = null;
  return ctx;
}

function stringify(val, forceBulkStrings) {
  var str = '', _str = null;
  if (val == null || val !== val) return forceBulkStrings ? false : '$-1' + CRLF;

  var type = typeof val;
  if (forceBulkStrings && type !== 'object') {
    val = val + '';
    return '$' + Buffer.byteLength(val, 'utf8') + CRLF + val + CRLF;
  }

  switch (type) {
    case 'string':
      return '+' + val + CRLF;
    case 'number':
      return ':' + val + CRLF;
  }

  if (util.isError(val)) return '-' + val.name + ' ' + val.message + CRLF;

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

  if (str) return new Buffer(str, 'utf8');

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
  return index === buffer.length ? buffer : buffer.slice(0, index);
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
      var fragment = result.content.match(/^(\S+) ([\s\S]+)$/);
      if (!fragment) return new Error('Parse "-" failed');
      result.content = new Error(fragment[2]);
      result.content.name = fragment[1];
      return result;

    case 58: // ':'
      result.content = +result.content;
      if (result.content !== result.content) return new Error('Parse ":" failed');
      return result;

    case 36: // '$'
      len = +result.content;
      if (!result.content.length || len !== len) return new Error('Parse "$" failed, invalid length');
      if (len === -1) result.content = null;
      else if (buffer.length < result.index + len + 2) return null;
      else if (!isCRLF(buffer, result.index + len)) return new Error('Parse "$" failed, invalid CRLF');
      else {
        result.content = buffer[returnBuffers ? 'slice' : 'utf8Slice'](result.index, result.index + len);
        result.index = result.index + len + 2;
      }
      return result;

    case 42: // '*'
      len = +result.content;
      if (!result.content.length || len !== len) return new Error('Parse "*" failed, invalid length');
      if (len === -1) result.content = null;
      else if (len === 0) result.content = [];
      else {
        result.content = Array(len);
        for (var i = 0; i < len; i++) {
          var _result = parseBuffer(buffer, result.index, returnBuffers);
          if (_result == null || _result instanceof Error) return _result;
          result.content[i] = _result.content;
          result.index = _result.index;
        }
      }
      return result;
  }
  return new Error('Invalid Chunk: parse failed');
}

function isCRLF(buffer, index) {
  return buffer[index] === 13 && buffer[index + 1] === 10;
}
