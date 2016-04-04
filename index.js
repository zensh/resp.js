'use strict'
/*
 * RESP.js
 * https://github.com/zensh/resp.js
 *
 * Copyright (c) 2014-2016 Yan Qing
 * Licensed under the MIT license.
 */

var util = require('util')
var EventEmitter = require('events').EventEmitter
var isInteger = Number.isInteger || function (num) {
  return num === Math.floor(num)
}
var CRLF = '\r\n'

module.exports = Resp
Resp.Resp = Resp

Resp.encodeNull = function () {
  return new Buffer([36, 45, 49, 13, 10])
}

Resp.encodeNullArray = function () {
  return new Buffer([42, 45, 49, 13, 10])
}

Resp.encodeString = function (str) {
  if (typeof str !== 'string') throw new TypeError(String(str) + ' must be string')
  return new Buffer('+' + str + CRLF)
}

Resp.encodeError = function (err) {
  if (!util.isError(err)) throw new TypeError(String(err) + ' must be Error object')
  return new Buffer('-' + err.name + ' ' + err.message + CRLF)
}

Resp.encodeInteger = function (num) {
  if (!isInteger(num)) throw new TypeError(String(num) + ' must be Integer')
  return new Buffer(':' + num + CRLF)
}

Resp.encodeBulk = function (str) {
  if (!arguments.length) throw new Error('no value to encode')
  str = String(str)
  return new Buffer('$' + Buffer.byteLength(str, 'utf8') + CRLF + str + CRLF)
}

Resp.encodeBufBulk = function (buf) {
  if (!Buffer.isBuffer(buf)) throw new TypeError(String(buf) + ' must be Buffer object')
  var prefix = '$' + buf.length + CRLF
  var buffer = new Buffer(prefix.length + buf.length + 2)
  buffer.write(prefix)
  buf.copy(buffer, prefix.length)
  buffer.write(CRLF, prefix.length + buf.length)
  return buffer
}

Resp.encodeArray = function (array) {
  if (!Array.isArray(array)) throw new Error(String(array) + ' must be Array object')
  var prefix = '*' + array.length + CRLF
  var length = prefix.length
  var bufs = [new Buffer(prefix)]

  for (var buf, i = 0, len = array.length; i < len; i++) {
    buf = array[i]
    if (Array.isArray(buf)) buf = Resp.encodeArray(buf)
    else if (!Buffer.isBuffer(buf)) throw new TypeError(String(buf) + ' must be RESP Buffer value')
    bufs.push(buf)
    length += buf.length
  }

  return Buffer.concat(bufs, length)
}

Resp.encodeRequest = function (array) {
  if (!Array.isArray(array) || !array.length) throw new Error(String(array) + ' must be array of value')
  var bulks = Array(array.length)
  for (var i = 0, len = array.length; i < len; i++) {
    bulks[i] = Buffer.isBuffer(array[i]) ? Resp.encodeBufBulk(array[i]) : Resp.encodeBulk(array[i])
  }
  return Resp.encodeArray(bulks)
}

// Decode a RESP buffer to RESP value
Resp.decode = function (buffer, bufBulk) {
  var res = parseBuffer(buffer, 0, bufBulk)
  if (!res || res.index < buffer.length) throw new Error('Parse "' + buffer + '" failed')
  if (res instanceof Error) throw res
  return res.content
}

function Resp (options) {
  if (!(this instanceof Resp)) return new Resp(options)
  options = options || {}
  this._bufBulk = !!options.bufBulk
  if (options.returnBuffers) this._bufBulk = true

  // legacy from old stream.
  this.writable = true
  clearState(this)
  EventEmitter.call(this)
}
util.inherits(Resp, EventEmitter)

Resp.prototype.write = function (buffer) {
  if (!Buffer.isBuffer(buffer)) {
    this.emit('error', new Error('Invalid buffer chunk'))
    return true
  }

  if (!this._buffer) this._buffer = buffer
  else {
    var ret = this._buffer.length - this._index
    var concatBuffer = new Buffer(buffer.length + ret)

    this._buffer.copy(concatBuffer, 0, this._index)
    buffer.copy(concatBuffer, ret)
    this._buffer = concatBuffer
    this._index = 0
  }

  while (this._index < this._buffer.length) {
    var result = parseBuffer(this._buffer, this._index, this._bufBulk)
    if (result == null) {
      this.emit('drain')
      return true
    }
    if (result instanceof Error) {
      clearState(this)
      this.emit('error', result)
      return false
    }
    this._index = result.index
    this.emit('data', result.content)
  }

  clearState(this).emit('drain')
  return true
}

Resp.prototype.end = function (chunk) {
  if (chunk) this.write(chunk)
  this.emit('finish')
}

function clearState (ctx) {
  ctx._index = 0
  ctx._buffer = null
  return ctx
}

function readBuffer (buffer, index) {
  var start = index
  while (index < buffer.length && !isCRLF(buffer, index)) index++

  return index >= buffer.length ? null : {
    content: buffer.utf8Slice(start, index),
    index: index + 2
  }
}

function parseBuffer (buffer, index, bufBulk) {
  var result = null
  var num = NaN
  if (index >= buffer.length) return null

  switch (buffer[index]) {
    case 43: // '+'
      return readBuffer(buffer, index + 1)

    case 45: // '-'
      result = readBuffer(buffer, index + 1)
      if (result == null) return result
      var fragment = result.content.match(/^(\S+) ([\s\S]+)$/)
      if (!fragment) fragment = [null, 'Error', result.content]
      result.content = new Error(fragment[2])
      result.content.name = result.content.code = fragment[1]
      return result

    case 58: // ':'
      result = readBuffer(buffer, index + 1)
      if (result == null) return result
      num = parseInteger(result.content)
      if (num === false) return new Error('Parse ":" failed')
      result.content = num
      return result

    case 36: // '$'
      result = readBuffer(buffer, index + 1)
      if (result == null) return result
      num = parseInteger(result.content)
      if (num === false || num < -1) return new Error('Parse "$" failed, invalid length')
      var endIndex = result.index + num

      if (num === -1) {
        // Null Bulk
        result.content = null
      } else if (buffer.length < endIndex + 2) {
        return null
      } else if (!isCRLF(buffer, endIndex)) {
        return new Error('Parse "$" failed, invalid CRLF')
      } else {
        result.content = buffer[bufBulk ? 'slice' : 'utf8Slice'](result.index, endIndex)
        result.index = endIndex + 2
      }
      return result

    case 42: // '*'
      result = readBuffer(buffer, index + 1)
      if (result == null) return result
      num = parseInteger(result.content)
      if (num === false || num < -1) return new Error('Parse "*" failed, invalid length')

      if (num === -1) {
        // Null Array
        result.content = null
      } else if (num === 0) {
        result.content = []
      } else {
        result.content = Array(num)
        for (var _result, i = 0; i < num; i++) {
          _result = parseBuffer(buffer, result.index, bufBulk)
          if (_result == null || _result instanceof Error) return _result
          result.content[i] = _result.content
          result.index = _result.index
        }
      }
      return result
  }
  return new Error('Invalid Chunk: parse failed')
}

function parseInteger (str) {
  var num = +str
  return (str && isInteger(num)) ? num : false
}

function isCRLF (buffer, index) {
  return buffer[index] === 13 && buffer[index + 1] === 10
}
