/*
 * RESP.js
 * https://github.com/zensh/resp.js
 *
 * Copyright (c) 2014-2016 Yan Qing
 * Licensed under the MIT license.
 */
'use strict'

const util = require('util')
const EventEmitter = require('events')

const CRLF = '\r\n'
// `Buffer.from` in old version do not support string.
const newBuf = (Buffer.alloc && Buffer.from) || ((str) => new Buffer(str))
const allocBuffer = Buffer.allocUnsafe || ((size) => new Buffer(size))

class Resp extends EventEmitter {
  constructor (options) {
    super()

    options = options || {}
    this._bufBulk = !!options.bufBulk

    // legacy from old stream.
    this.writable = true
    clearState(this)
  }

  static encodeNull () {
    return newBuf('$-1\r\n')
  }

  static encodeNullArray () {
    return newBuf('*-1\r\n')
  }

  static encodeString (str) {
    if (typeof str !== 'string') throw new TypeError(String(str) + ' must be string')
    return newBuf('+' + str + CRLF)
  }

  static encodeError (err) {
    if (!util.isError(err)) throw new TypeError(String(err) + ' must be Error object')
    return newBuf('-' + err.name + ' ' + err.message + CRLF)
  }

  static encodeInteger (num) {
    if (!Number.isInteger(num)) throw new TypeError(String(num) + ' must be Integer')
    return newBuf(':' + num + CRLF)
  }

  static encodeBulk (str) {
    if (!arguments.length) throw new Error('no value to encode')
    str = String(str)
    return newBuf('$' + Buffer.byteLength(str, 'utf8') + CRLF + str + CRLF)
  }

  static encodeBufBulk (buf) {
    if (!Buffer.isBuffer(buf)) throw new TypeError(String(buf) + ' must be Buffer object')
    let prefix = '$' + buf.length + CRLF
    let buffer = allocBuffer(prefix.length + buf.length + 2)
    buffer.write(prefix)
    buf.copy(buffer, prefix.length)
    buffer.write(CRLF, prefix.length + buf.length)
    return buffer
  }

  static encodeArray (array) {
    if (!Array.isArray(array)) throw new Error(String(array) + ' must be Array object')
    let prefix = '*' + array.length + CRLF
    let length = prefix.length
    let bufs = [newBuf(prefix)]

    for (let buf, i = 0, len = array.length; i < len; i++) {
      buf = array[i]
      if (Array.isArray(buf)) buf = Resp.encodeArray(buf)
      else if (!Buffer.isBuffer(buf)) throw new TypeError(String(buf) + ' must be RESP Buffer value')
      bufs.push(buf)
      length += buf.length
    }

    return Buffer.concat(bufs, length)
  }

  static encodeRequest (array) {
    if (!Array.isArray(array) || !array.length) {
      throw new Error(String(array) + ' must be array of value')
    }
    let bulks = Array(array.length)
    for (let i = 0, len = array.length; i < len; i++) {
      bulks[i] = Buffer.isBuffer(array[i]) ? Resp.encodeBufBulk(array[i]) : Resp.encodeBulk(array[i])
    }
    return Resp.encodeArray(bulks)
  }

  // Decode a RESP buffer to RESP value
  static decode (buffer, bufBulk) {
    let res = parseBuffer(buffer, 0, bufBulk)
    if (!res || res.index < buffer.length) throw new Error('Parse "' + buffer + '" failed')
    if (res instanceof Error) throw res
    return res.content
  }

  write (buffer) {
    if (!Buffer.isBuffer(buffer)) {
      this.emit('error', new Error('Invalid buffer chunk'))
      return true
    }

    if (!this._buffer) this._buffer = buffer
    else {
      let ret = this._buffer.length - this._index
      let concatBuffer = allocBuffer(buffer.length + ret)

      this._buffer.copy(concatBuffer, 0, this._index)
      buffer.copy(concatBuffer, ret)
      this._buffer = concatBuffer
      this._index = 0
    }

    while (this._index < this._buffer.length) {
      let result = parseBuffer(this._buffer, this._index, this._bufBulk)
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

  end (chunk) {
    if (chunk) this.write(chunk)
    this.emit('finish')
  }
}

function clearState (ctx) {
  ctx._index = 0
  ctx._buffer = null
  return ctx
}

class ReadRes {
  constructor (content, index) {
    this.content = content
    this.index = index
  }
}

function readBuffer (buffer, index) {
  let start = index
  while (index < buffer.length && !isCRLF(buffer, index)) index++
  return index >= buffer.length ? null : new ReadRes(buffer.utf8Slice(start, index), index + 2)
}

function parseBuffer (buffer, index, bufBulk) {
  let result = null
  let num = NaN
  if (index >= buffer.length) return null

  switch (buffer[index]) {
    case 43: // '+'
      return readBuffer(buffer, index + 1)

    case 45: // '-'
      result = readBuffer(buffer, index + 1)
      if (result == null) return result
      let fragment = result.content.match(/^(\S+) ([\s\S]+)$/)
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
      let endIndex = result.index + num

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
        for (let _result, i = 0; i < num; i++) {
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
  let num = +str
  return (str && Number.isInteger(num)) ? num : false
}

function isCRLF (buffer, index) {
  return buffer[index] === 13 && buffer[index + 1] === 10
}

module.exports = Resp.Resp = Resp
