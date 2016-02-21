'use strict'
/*global describe, it*/

var assert = require('assert')
var Resp = require('..')

describe('Respjs', function () {
  describe('encode', function () {
    it('Resp.encodeNull()', function () {
      assert.strictEqual(Resp.encodeNull().toString(), '$-1\r\n')
    })

    it('Resp.encodeNullArray()', function () {
      assert.strictEqual(Resp.encodeNullArray().toString(), '*-1\r\n')
    })

    it('Resp.encodeString(str)', function () {
      assert.strictEqual(Resp.encodeString('OK').toString(), '+OK\r\n')
      assert.strictEqual(Resp.encodeString('').toString(), '+\r\n')
      assert.throws(function () { Resp.encodeString() })
      assert.throws(function () { Resp.encodeString(null) })
      assert.throws(function () { Resp.encodeString(1) })
    })

    it('Resp.encodeError(error)', function () {
      assert.strictEqual(Resp.encodeError(new Error('error')).toString(), '-Error error\r\n')
      assert.strictEqual(Resp.encodeError(new TypeError('error')).toString(), '-TypeError error\r\n')
      assert.throws(function () { Resp.encodeError({}) })
      assert.throws(function () { Resp.encodeError(null) })
      assert.throws(function () { Resp.encodeError('error') })
    })

    it('Resp.encodeInteger(num)', function () {
      assert.strictEqual(Resp.encodeInteger(123).toString(), ':123\r\n')
      assert.strictEqual(Resp.encodeInteger(-1).toString(), ':-1\r\n')
      assert.throws(function () { Resp.encodeInteger() })
      assert.throws(function () { Resp.encodeInteger(1.1) })
      assert.throws(function () { Resp.encodeInteger('1') })
    })

    it('Resp.encodeBulk(str)', function () {
      assert.strictEqual(Resp.encodeBulk('message').toString(), '$7\r\nmessage\r\n')
      assert.strictEqual(Resp.encodeBulk(123).toString(), '$3\r\n123\r\n')
      assert.strictEqual(Resp.encodeBulk(-1).toString(), '$2\r\n-1\r\n')
      assert.strictEqual(Resp.encodeBulk('').toString(), '$0\r\n\r\n')
      assert.strictEqual(Resp.encodeBulk(null).toString(), '$4\r\nnull\r\n')
      assert.throws(function () { Resp.encodeBulk() })
    })

    it('Resp.encodeBufBulk(buf)', function () {
      assert.strictEqual(Resp.encodeBufBulk(new Buffer('buf')).toString(), '$3\r\nbuf\r\n')
      assert.strictEqual(Resp.encodeBufBulk(new Buffer('')).toString(), '$0\r\n\r\n')
      assert.throws(function () { Resp.encodeBufBulk() })
      assert.throws(function () { Resp.encodeBufBulk(null) })
      assert.throws(function () { Resp.encodeBufBulk('123') })
    })

    it('Resp.encodeArray(array)', function () {
      assert.strictEqual(Resp.encodeArray([]).toString(), '*0\r\n')
      assert.strictEqual(Resp.encodeArray([Resp.encodeNull(), Resp.encodeString('OK'), []]).toString(),
        '*3\r\n$-1\r\n+OK\r\n*0\r\n')
      assert.throws(function () { Resp.encodeArray() })
      assert.throws(function () { Resp.encodeArray([1]) })
      assert.throws(function () { Resp.encodeArray([Resp.encodeNull(), null]) })
    })

    it('Resp.encodeRequest(array)', function () {
      assert.strictEqual(Resp.encodeRequest(['']).toString(), '*1\r\n$0\r\n\r\n')
      assert.strictEqual(Resp.encodeRequest(['info']).toString(), '*1\r\n$4\r\ninfo\r\n')
      assert.strictEqual(Resp.encodeRequest(['set', 'key', 123]).toString(), '*3\r\n$3\r\nset\r\n$3\r\nkey\r\n$3\r\n123\r\n')
      assert.strictEqual(Resp.encodeRequest(['set', 'key', '123']).toString(), '*3\r\n$3\r\nset\r\n$3\r\nkey\r\n$3\r\n123\r\n')
      assert.strictEqual(Resp.encodeRequest(['set', 'key', new Buffer('123')]).toString(), '*3\r\n$3\r\nset\r\n$3\r\nkey\r\n$3\r\n123\r\n')

      assert.throws(function () { Resp.encodeRequest([]) })
      assert.throws(function () { Resp.encodeRequest('') })
      assert.throws(function () { Resp.encodeRequest(1) })
    })
  })

  describe('decode', function () {
    it('Resp.decode(buffer, returnBuffer)', function () {
      assert.strictEqual(Resp.decode(Resp.encodeNull()), null)
      assert.strictEqual(Resp.decode(Resp.encodeNull(), true), null)

      assert.strictEqual(Resp.decode(Resp.encodeNullArray()), null)
      assert.strictEqual(Resp.decode(Resp.encodeNullArray(), true), null)

      assert.strictEqual(Resp.decode(Resp.encodeString('123')), '123')
      assert.strictEqual(Resp.decode(Resp.encodeString('123'), true), '123')

      assert.strictEqual(Resp.decode(Resp.encodeError(new Error('err'))) instanceof Error, true)
      assert.strictEqual(Resp.decode(Resp.encodeError(new Error('err')), true) instanceof Error, true)
      var err = Resp.decode(Resp.encodeError(new TypeError('err')))
      assert.strictEqual(err.name, 'TypeError')
      assert.strictEqual(err.code, 'TypeError')
      assert.strictEqual(err.message, 'err')

      assert.strictEqual(Resp.decode(Resp.encodeInteger(123)), 123)
      assert.strictEqual(Resp.decode(Resp.encodeInteger(123), true), 123)

      assert.strictEqual(Resp.decode(Resp.encodeBulk(123)), '123')
      assert.strictEqual(Resp.decode(Resp.encodeBulk('123')), '123')
      assert.strictEqual(Resp.decode(Resp.encodeBulk(123), true).equals(new Buffer('123')), true)
      assert.strictEqual(Resp.decode(Resp.encodeBulk('123'), true).equals(new Buffer('123')), true)

      assert.strictEqual(Resp.decode(Resp.encodeBufBulk(new Buffer('123'))), '123')
      assert.strictEqual(Resp.decode(Resp.encodeBufBulk(new Buffer('123')), true).equals(new Buffer('123')), true)

      assert.deepEqual(Resp.decode(Resp.encodeArray([])), [])
      assert.deepEqual(Resp.decode(Resp.encodeArray([[], [[]]])), [[], [[]]])
      assert.deepEqual(Resp.decode(Resp.encodeArray([Resp.encodeNull(), Resp.encodeInteger(123)])), [null, 123])
      assert.deepEqual(Resp.decode(Resp.encodeArray([Resp.encodeNull(), Resp.encodeInteger(123)]), true), [null, 123])

      assert.deepEqual(Resp.decode(Resp.encodeRequest(['set', 'key', 123])), ['set', 'key', '123'])
      assert.deepEqual(Resp.decode(Resp.encodeRequest(['set', 'key', 123]), true),
        [new Buffer('set'), new Buffer('key'), new Buffer('123')])

      assert.throws(function () { Resp.decode() })
      assert.throws(function () { Resp.decode(null) })
      assert.throws(function () { Resp.decode(1) })
      assert.throws(function () { Resp.decode(new Buffer('123')) })
      assert.throws(function () {
        var buf = Resp.encodeBulk('123')
        buf[buf.length - 1] = 0
        Resp.decode(buf)
      })
      assert.throws(function () {
        var buf = Buffer.concat([Resp.encodeBulk('123'), new Buffer('1')])
        Resp.decode(buf)
      })
    })

    it('new Resp()', function (done) {
      var result = []
      var reply = Resp()

      reply
        .on('data', function (data) {
          result.push(data)
        })
        .on('finish', function () {
          assert.deepEqual(result, ['0', '2', '', '中文', [], [[]], ['set', 'key', '123']])
          done()
        })

      reply.write(Resp.encodeBulk(0))
      reply.write(Resp.encodeBulk('2'))
      reply.write(Resp.encodeBulk(''))
      reply.write(Resp.encodeBulk('中文'))
      reply.write(Resp.encodeArray([]))
      reply.write(Resp.encodeArray([[]]))
      reply.write(Resp.encodeRequest(['set', 'key', 123]))
      reply.end()
    })

    it('new Resp({bufBulk: true})', function (done) {
      var reply = Resp({bufBulk: true})

      reply
        .on('data', function (data) {
          assert.strictEqual(Buffer.isBuffer(data), true)
        })
        .on('finish', done)

      reply.write(new Buffer('$6\r\n中文\r\n'))
      reply.write(Resp.encodeBulk('abc'))
      reply.end()
    })

    it('new Resp(): Pipelining data', function (done) {
      var result = []
      var reply = Resp()

      reply
        .on('data', function (data) {
          result.push(data)
        })
        .on('finish', function () {
          assert.deepEqual(result, ['中文', '', '123'])
          done()
        })

      reply.write(new Buffer('$6\r\n中文\r\n$0'))
      reply.write(new Buffer('\r\n\r\n'))
      reply.write(Resp.encodeBulk(123))
      reply.end()
    })

    it('new Resp(): with non resp buffer', function (done) {
      var reply = Resp()

      reply
        .on('error', function (error) {
          assert.strictEqual(error instanceof Error, true)
          assert.strictEqual(error.message, 'Invalid Chunk: parse failed')
          done()
        })

      reply.write(new Buffer('non resp buffer'))
    })

    it('new Resp(): with error data', function (done) {
      var result = []
      var reply = Resp()

      reply
        .on('data', function (data) {
          result.push(data)
        })
        .on('error', function (error) {
          assert.strictEqual(error instanceof Error, true)
          result.push('')
        })
        .on('finish', function () {
          assert.deepEqual(result, ['', '', '123'])
          done()
        })

      reply.write(new Buffer('$6\r\n中文1\r\n$0'))
      reply.write(new Buffer('\r\n\r\n'))
      reply.write(Resp.encodeBulk('123'))
      reply.end()
    })

    it('new Resp(): chaos', function (done) {
      var result = []
      var reply = Resp()
      var buf = Resp.encodeArray([
        Resp.encodeNull(),
        Resp.encodeString('OKOKOKOK'),
        Resp.encodeInteger(123456789),
        Resp.encodeBulk('message'),
        Resp.encodeBufBulk(new Buffer('buf')),
        Resp.encodeRequest(['set', 'key', '123正正abc'])
      ])
      var bufs = []
      for (var i = 0; i < 10000; i++) bufs.push(buf)
      bufs = Buffer.concat(bufs)

      reply
        .on('data', function (data) {
          assert.deepEqual(data, [
            null,
            'OKOKOKOK',
            123456789,
            'message',
            'buf',
            ['set', 'key', '123正正abc']
          ])
          result.push(data)
        })
        .on('finish', function () {
          assert.strictEqual(result.length, 10000)
          done()
        })

      var start = 0
      var length = bufs.length
      consumer()

      function consumer () {
        if (start >= length) return reply.end()
        var end = start + Math.ceil(Math.random() * 100)
        if (end > length) end = length
        reply.write(bufs.slice(start, end))
        start = end
        setTimeout(consumer, 0)
      }
    })
  })
})

describe('Resp.js_old_test', function () {
  it('Resp.stringify(obj)', function () {
    assert.strictEqual(Resp.stringify(null), '$-1\r\n')
    assert.strictEqual(Resp.stringify(NaN), '$-1\r\n')
    assert.strictEqual(Resp.stringify(''), '+\r\n')
    assert.strictEqual(Resp.stringify('1'), '+1\r\n')
    assert.strictEqual(Resp.stringify('中文'), '+中文\r\n')
    assert.strictEqual(Resp.stringify(99), ':99\r\n')
    assert.strictEqual(Resp.stringify(-99), ':-99\r\n')
    assert.strictEqual(Resp.stringify(new Error('error')), '-Error error\r\n')
    var err = new Error('error')
    err.name = 'ERR'
    assert.strictEqual(Resp.stringify(err), '-ERR error\r\n')
    assert.strictEqual(Resp.stringify([]), '*0\r\n')
    assert.strictEqual(Resp.stringify([[1, 2, 3], ['Foo']]), '*2\r\n*3\r\n:1\r\n:2\r\n:3\r\n*1\r\n+Foo\r\n')
    assert.strictEqual(Resp.stringify(['foo', null, 'bar']), '*3\r\n+foo\r\n$-1\r\n+bar\r\n')
    assert.throws(function () { Resp.stringify({}) })
    assert.throws(function () { Resp.stringify([1, {}]) })
    assert.throws(function () { Resp.stringify(new Date()) })
  })

  it('Resp.stringify(obj, true)', function () {
    assert.strictEqual(Resp.stringify('', true), '$0\r\n\r\n')
    assert.strictEqual(Resp.stringify('1', true), '$1\r\n1\r\n')
    assert.strictEqual(Resp.stringify('中文', true), '$6\r\n中文\r\n')
    assert.strictEqual(Resp.stringify(99, true), '$2\r\n99\r\n')
    assert.strictEqual(Resp.stringify(-99, true), '$3\r\n-99\r\n')
    assert.strictEqual(Resp.stringify(new Error('error'), true), '-Error error\r\n')
    assert.strictEqual(Resp.stringify([], true), '*0\r\n')
    assert.strictEqual(Resp.stringify([[1, 2, 3], ['Foo']], true), '*2\r\n*3\r\n$1\r\n1\r\n$1\r\n2\r\n$1\r\n3\r\n*1\r\n$3\r\nFoo\r\n')
  })

  it('Resp.bufferify(obj)', function () {
    assert.strictEqual(Resp.bufferify('').equals(new Buffer('$0\r\n\r\n')), true)
    assert.strictEqual(Resp.bufferify('1').equals(new Buffer('$1\r\n1\r\n')), true)
    assert.strictEqual(Resp.bufferify('中文').equals(new Buffer('$6\r\n中文\r\n')), true)
    assert.strictEqual(Resp.bufferify(99).equals(new Buffer('$2\r\n99\r\n')), true)
    assert.strictEqual(Resp.bufferify(-99).equals(new Buffer('$3\r\n-99\r\n')), true)
    assert.strictEqual(Resp.bufferify(new Error('error')).equals(new Buffer('-Error error\r\n')), true)
    assert.strictEqual(Resp.bufferify([]).equals(new Buffer('*0\r\n')), true)
    assert.strictEqual(Resp.bufferify([[1, 2, 3], ['Foo']]).equals(new Buffer('*2\r\n*3\r\n$1\r\n1\r\n$1\r\n2\r\n$1\r\n3\r\n*1\r\n$3\r\nFoo\r\n')), true)
    assert.strictEqual(Resp.bufferify(new Buffer('中文')).equals(new Buffer('$6\r\n中文\r\n')), true)
    assert.throws(function () { Resp.bufferify({}) })
    assert.throws(function () { Resp.bufferify([1, {}]) })
  })

  it('Resp.parse(str)', function () {
    assert.strictEqual(Resp.parse('$-1\r\n'), null)
    assert.strictEqual(Resp.parse('+\r\n'), '')
    assert.strictEqual(Resp.parse('$0\r\n\r\n'), '')
    assert.strictEqual(Resp.parse('+1\r\n'), '1')
    assert.strictEqual(Resp.parse('+中文\r\n'), '中文')
    assert.strictEqual(Resp.parse(':99\r\n'), 99)
    assert.strictEqual(Resp.parse(':-99\r\n'), -99)
    assert.strictEqual(Resp.parse('-Error: error\r\n') instanceof Error, true)
    assert.deepEqual(Resp.parse('*0\r\n'), [])
    assert.deepEqual(Resp.parse('*2\r\n*3\r\n:1\r\n:2\r\n:3\r\n*2\r\n+Foo\r\n+Bar\r\n'), [[1, 2, 3], ['Foo', 'Bar']])
    assert.deepEqual(Resp.parse('*3\r\n+foo\r\n$-1\r\n+bar\r\n'), ['foo', null, 'bar'])
    var buf = Resp.parse('$6\r\n中文\r\n', true)
    assert.strictEqual(buf.length, 6)
    assert.strictEqual(buf.toString(), '中文')
    assert.throws(function () { Resp.parse('abc') })
    assert.throws(function () { Resp.parse('$-11\r\n') })
    assert.throws(function () { Resp.parse(':a\r\n') })
    assert.throws(function () { Resp.parse(':1\r\n1') })
    assert.throws(function () { Resp.parse('*2\r\n*3\r\n:1\r\n:2\r\n:3\r\n*2\r\n+Foo\r\n+Bar\r\n123') })
  })

  it('Resp.parse(Resp.stringify(obj))', function () {
    assert.strictEqual(Resp.parse(Resp.stringify(null)), null)
    assert.strictEqual(Resp.parse(Resp.stringify(1)), 1)
    assert.strictEqual(Resp.parse(Resp.stringify('1')), '1')
    assert.strictEqual(Resp.parse(Resp.stringify('中文')), '中文')
    assert.deepEqual(Resp.parse(Resp.stringify([])), [])
    assert.deepEqual(Resp.parse(Resp.stringify([[[]]])), [[[]]])
    assert.deepEqual(Resp.parse(Resp.stringify([1, '2', ['3']])), [1, '2', ['3']])
  })

  it('Resp.parse(Resp.bufferify(obj))', function () {
    assert.strictEqual(Resp.parse(Resp.bufferify(1)), '1')
    assert.strictEqual(Resp.parse(Resp.bufferify('1')), '1')
    assert.strictEqual(Resp.parse(Resp.bufferify('中文')), '中文')
    assert.deepEqual(Resp.parse(Resp.bufferify([])), [])
    assert.deepEqual(Resp.parse(Resp.bufferify([[[]]])), [[[]]])
    assert.deepEqual(Resp.parse(Resp.bufferify([1, '2', ['3']])), ['1', '2', ['3']])
    assert.deepEqual(Resp.parse(Resp.bufferify([1, new Buffer('中文')])), ['1', '中文'])
    var buf = new Buffer('中文')
    var res = Resp.parse(Resp.bufferify([1, buf]), true)
    assert.equal(res[0], '1')
    // no `equals` method in v0.10.x
    if (buf.equals) assert.equal(buf.equals(res[1]), true)
  })

  it('Resp()', function (done) {
    var result = []
    var reply = Resp()

    reply
      .on('data', function (data) {
        result.push(data)
      })
      .on('finish', function () {
        assert.deepEqual(result, ['0', '2', '', '中文', [], [[]]])
        done()
      })

    reply.write(Resp.bufferify(0))
    reply.write(Resp.bufferify('2'))
    reply.write(Resp.bufferify(''))
    reply.write(Resp.bufferify('中文'))
    reply.write(Resp.bufferify([]))
    reply.write(Resp.bufferify([[]]))
    reply.end()
  })

  it('Resp({returnBuffers: true})', function (done) {
    var reply = Resp({returnBuffers: true})

    reply
      .on('data', function (data) {
        assert.strictEqual(Buffer.isBuffer(data), true)
      })
      .on('finish', done)

    reply.write(new Buffer('$6\r\n中文\r\n'))
    reply.write(Resp.bufferify('abc'))
    reply.end()
  })

  it('Resp():Pipelining data', function (done) {
    var result = []
    var reply = Resp()

    reply
      .on('data', function (data) {
        result.push(data)
      })
      .on('finish', function () {
        assert.deepEqual(result, ['中文', '', '123'])
        done()
      })

    reply.write(new Buffer('$6\r\n中文\r\n$0'))
    reply.write(new Buffer('\r\n\r\n'))
    reply.write(Resp.bufferify(123))
    reply.end()
  })

  it('Resp():with non resp buffer', function (done) {
    var reply = Resp()

    reply
      .on('error', function (error) {
        assert.strictEqual(error instanceof Error, true)
        assert.strictEqual(error.message, 'Invalid Chunk: parse failed')
        done()
      })

    reply.write(new Buffer('non resp buffer'))
  })

  it('Resp():with error data', function (done) {
    var result = []
    var reply = Resp()

    reply
      .on('data', function (data) {
        result.push(data)
      })
      .on('error', function (error) {
        assert.strictEqual(error instanceof Error, true)
        result.push('')
      })
      .on('finish', function () {
        assert.deepEqual(result, ['', '', '123'])
        done()
      })

    reply.write(new Buffer('$6\r\n中文1\r\n$0'))
    reply.write(new Buffer('\r\n\r\n'))
    reply.write(Resp.bufferify('123'))
    reply.end()
  })
})
