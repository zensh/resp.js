'use strict'
/*
 * RESP.js
 * https://github.com/zensh/resp.js
 *
 * Copyright (c) 2014-2017 Yan Qing
 * Licensed under the MIT license.
 */

const EventEmitter = require('events')
const CRLF = '\r\n'

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
    return Buffer.from('$-1\r\n')
  }

  static encodeNullArray () {
    return Buffer.from('*-1\r\n')
  }

  static encodeString (str) {
    if (typeof str !== 'string') throw new TypeError(String(str) + ' must be string')
    return Buffer.from('+' + str + CRLF)
  }

  static encodeError (err) {
    if (!(err instanceof Error)) throw new TypeError(String(err) + ' must be Error object')
    return Buffer.from('-' + err.name + ' ' + err.message + CRLF)
  }

  static encodeInteger (num) {
    if (!Number.isInteger(num)) throw new TypeError(String(num) + ' must be Integer')
    return Buffer.from(':' + num + CRLF)
  }

  static encodeBulk (str) {
    if (!arguments.length) throw new Error('no value to encode')
    str = String(str)
    return Buffer.from('$' + Buffer.byteLength(str, 'utf8') + CRLF + str + CRLF)
  }

  static encodeBufBulk (buf) {
    if (!Buffer.isBuffer(buf)) throw new TypeError(String(buf) + ' must be Buffer object')
    let prefix = '$' + buf.length + CRLF
    let buffer = Buffer.allocUnsafe(prefix.length + buf.length + 2)
    buffer.write(prefix)
    buf.copy(buffer, prefix.length)
    buffer.write(CRLF, prefix.length + buf.length)
    return buffer
  }

  static encodeArray (arr) {
    if (!Array.isArray(arr)) throw new Error(String(arr) + ' must be Array object')
    let prefix = '*' + arr.length + CRLF
    let length = prefix.length
    let bufs = [Buffer.from(prefix)]

    for (let buf, i = 0, len = arr.length; i < len; i++) {
      buf = arr[i]
      if (Array.isArray(buf)) buf = Resp.encodeArray(buf)
      else if (!Buffer.isBuffer(buf)) throw new TypeError(String(buf) + ' must be RESP Buffer value')
      bufs.push(buf)
      length += buf.length
    }

    return Buffer.concat(bufs, length)
  }

  static encodeRequest (arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
      throw new Error(String(arr) + ' must be array of value')
    }
    let bulks = Array(arr.length)
    for (let i = 0, len = arr.length; i < len; i++) {
      bulks[i] = Buffer.isBuffer(arr[i]) ? Resp.encodeBufBulk(arr[i]) : Resp.encodeBulk(arr[i])
    }
    return Resp.encodeArray(bulks)
  }

  // Decode a RESP buffer to RESP value
  static decode (buf, bufBulk) {
    let res = parseBuffer(buf, 0, bufBulk)
    if (!res || res.index < buf.length) throw new Error('Parse "' + buf + '" failed')
    if (res instanceof Error) throw res
    return res.content
  }

  write (buf) {
    if (!Buffer.isBuffer(buf)) {
      this.emit('error', new Error('Invalid buffer chunk'))
      return true
    }

    if (!this._buf) this._buf = buf
    else {
      let ret = this._buf.length - this._pos
      let _buf = Buffer.allocUnsafe(buf.length + ret)

      this._buf.copy(_buf, 0, this._pos)
      buf.copy(_buf, ret)
      this._buf = _buf
      this._pos = 0
    }

    while (this._pos < this._buf.length) {
      let result = parseBuffer(this._buf, this._pos, this._bufBulk)
      if (result == null) {
        this.emit('drain')
        return true
      }
      if (result instanceof Error) {
        clearState(this)
        this.emit('error', result)
        return false
      }
      this._pos = result.index
      this.emit('data', result.content)
    }

    clearState(this).emit('drain')
    return true
  }

  end (buf) {
    if (buf != null) this.write(buf)
    this.emit('finish')
  }
}

function clearState (ctx) {
  ctx._pos = 0
  ctx._buf = null
  return ctx
}

class ReadRes {
  constructor (content, index) {
    this.content = content
    this.index = index
  }
}

function readBuffer (buf, i) {
  let start = i
  let len = buf.length
  while (i < len && !isCRLF(buf, i)) i++
  return i >= len ? null : new ReadRes(buf.utf8Slice(start, i), i + 2)
}

function parseBuffer (buf, index, bufBulk) {
  let result = null
  let num = NaN
  if (index >= buf.length) return null

  switch (buf[index]) {
    case 43: // '+'
      return readBuffer(buf, index + 1)

    case 45: // '-'
      result = readBuffer(buf, index + 1)
      if (result == null) return result
      let fragment = result.content.match(/^(\S+) ([\s\S]+)$/)
      if (!fragment) fragment = [null, 'Error', result.content]
      result.content = new Error(fragment[2])
      result.content.name = result.content.code = fragment[1]
      return result

    case 58: // ':'
      result = readBuffer(buf, index + 1)
      if (result == null) return result
      num = parseInteger(result.content)
      if (num === false) return new Error('Parse ":" failed')
      result.content = num
      return result

    case 36: // '$'
      result = readBuffer(buf, index + 1)
      if (result == null) return result
      num = parseInteger(result.content)
      if (num === false || num < -1) return new Error('Parse "$" failed, invalid length')
      let endIndex = result.index + num

      if (num === -1) {
        // Null Bulk
        result.content = null
      } else if (buf.length < endIndex + 2) {
        return null
      } else if (!isCRLF(buf, endIndex)) {
        return new Error('Parse "$" failed, invalid CRLF')
      } else {
        result.content = buf[bufBulk ? 'slice' : 'utf8Slice'](result.index, endIndex)
        result.index = endIndex + 2
      }
      return result

    case 42: // '*'
      result = readBuffer(buf, index + 1)
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
          _result = parseBuffer(buf, result.index, bufBulk)
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

function isCRLF (buf, i) {
  return buf[i] === 13 && buf[i + 1] === 10
}

module.exports = Resp.Resp = Resp
