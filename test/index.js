'use strict'

const assert = require('assert')
const tman = require('tman')

test(require('..'))
test(require('@std/esm')(module)('../index.mjs').default)

function test (Resp) {
  tman.suite('Respjs', function () {
    tman.suite('encode', function () {
      tman.it('Resp.encodeNull()', function () {
        assert.strictEqual(Resp.encodeNull().toString(), '$-1\r\n')
      })

      tman.it('Resp.encodeNullArray()', function () {
        assert.strictEqual(Resp.encodeNullArray().toString(), '*-1\r\n')
      })

      tman.it('Resp.encodeString(str)', function () {
        assert.strictEqual(Resp.encodeString('OK').toString(), '+OK\r\n')
        assert.strictEqual(Resp.encodeString('').toString(), '+\r\n')
        assert.throws(function () { Resp.encodeString() })
        assert.throws(function () { Resp.encodeString(null) })
        assert.throws(function () { Resp.encodeString(1) })
      })

      tman.it('Resp.encodeError(error)', function () {
        assert.strictEqual(Resp.encodeError(new Error('error')).toString(), '-Error error\r\n')
        assert.strictEqual(Resp.encodeError(new TypeError('error')).toString(), '-TypeError error\r\n')
        assert.throws(function () { Resp.encodeError({}) })
        assert.throws(function () { Resp.encodeError(null) })
        assert.throws(function () { Resp.encodeError('error') })
      })

      tman.it('Resp.encodeInteger(num)', function () {
        assert.strictEqual(Resp.encodeInteger(123).toString(), ':123\r\n')
        assert.strictEqual(Resp.encodeInteger(-1).toString(), ':-1\r\n')
        assert.strictEqual(Resp.encodeInteger(1456061893587000000).toString(), ':1456061893587000000\r\n')
        assert.throws(function () { Resp.encodeInteger() })
        assert.throws(function () { Resp.encodeInteger(1.1) })
        assert.throws(function () { Resp.encodeInteger('1') })
      })

      tman.it('Resp.encodeBulk(str)', function () {
        assert.strictEqual(Resp.encodeBulk('message').toString(), '$7\r\nmessage\r\n')
        assert.strictEqual(Resp.encodeBulk(123).toString(), '$3\r\n123\r\n')
        assert.strictEqual(Resp.encodeBulk(-1).toString(), '$2\r\n-1\r\n')
        assert.strictEqual(Resp.encodeBulk('').toString(), '$0\r\n\r\n')
        assert.strictEqual(Resp.encodeBulk(null).toString(), '$4\r\nnull\r\n')
        assert.throws(function () { Resp.encodeBulk() })
      })

      tman.it('Resp.encodeBufBulk(buf)', function () {
        assert.strictEqual(Resp.encodeBufBulk(Buffer.from('buf')).toString(), '$3\r\nbuf\r\n')
        assert.strictEqual(Resp.encodeBufBulk(Buffer.from('')).toString(), '$0\r\n\r\n')
        assert.throws(function () { Resp.encodeBufBulk() })
        assert.throws(function () { Resp.encodeBufBulk(null) })
        assert.throws(function () { Resp.encodeBufBulk('123') })
      })

      tman.it('Resp.encodeArray(array)', function () {
        assert.strictEqual(Resp.encodeArray([]).toString(), '*0\r\n')
        assert.strictEqual(Resp.encodeArray([Resp.encodeNull(), Resp.encodeString('OK'), []]).toString(),
          '*3\r\n$-1\r\n+OK\r\n*0\r\n')
        assert.throws(function () { Resp.encodeArray() })
        assert.throws(function () { Resp.encodeArray([1]) })
        assert.throws(function () { Resp.encodeArray([Resp.encodeNull(), null]) })
      })

      tman.it('Resp.encodeRequest(array)', function () {
        assert.strictEqual(Resp.encodeRequest(['']).toString(), '*1\r\n$0\r\n\r\n')
        assert.strictEqual(Resp.encodeRequest(['info']).toString(), '*1\r\n$4\r\ninfo\r\n')
        assert.strictEqual(Resp.encodeRequest(['set', 'key', 123]).toString(), '*3\r\n$3\r\nset\r\n$3\r\nkey\r\n$3\r\n123\r\n')
        assert.strictEqual(Resp.encodeRequest(['set', 'key', '123']).toString(), '*3\r\n$3\r\nset\r\n$3\r\nkey\r\n$3\r\n123\r\n')
        assert.strictEqual(Resp.encodeRequest(['set', 'key', Buffer.from('123')]).toString(), '*3\r\n$3\r\nset\r\n$3\r\nkey\r\n$3\r\n123\r\n')

        assert.throws(function () { Resp.encodeRequest([]) })
        assert.throws(function () { Resp.encodeRequest('') })
        assert.throws(function () { Resp.encodeRequest(1) })
      })
    })

    tman.suite('decode', function () {
      tman.it('Resp.decode(buffer, returnBuffer)', function () {
        assert.strictEqual(Resp.decode(Resp.encodeNull()), null)
        assert.strictEqual(Resp.decode(Resp.encodeNull(), true), null)

        assert.strictEqual(Resp.decode(Resp.encodeNullArray()), null)
        assert.strictEqual(Resp.decode(Resp.encodeNullArray(), true), null)

        assert.strictEqual(Resp.decode(Resp.encodeString('123')), '123')
        assert.strictEqual(Resp.decode(Resp.encodeString('123'), true), '123')

        assert.strictEqual(Resp.decode(Resp.encodeError(new Error('err'))) instanceof Error, true)
        assert.strictEqual(Resp.decode(Resp.encodeError(new Error('err')), true) instanceof Error, true)

        let err = Resp.decode(Resp.encodeError(new TypeError('err')))
        assert.strictEqual(err.name, 'TypeError')
        assert.strictEqual(err.code, 'TypeError')
        assert.strictEqual(err.message, 'err')

        assert.strictEqual(Resp.decode(Resp.encodeInteger(123)), 123)
        assert.strictEqual(Resp.decode(Resp.encodeInteger(1456061893587000000)), 1456061893587000000)
        assert.strictEqual(Resp.decode(Resp.encodeInteger(123), true), 123)

        assert.strictEqual(Resp.decode(Resp.encodeBulk(123)), '123')
        assert.strictEqual(Resp.decode(Resp.encodeBulk('123')), '123')
        assert.strictEqual(Resp.decode(Resp.encodeBulk(123), true).equals(Buffer.from('123')), true)
        assert.strictEqual(Resp.decode(Resp.encodeBulk('123'), true).equals(Buffer.from('123')), true)

        assert.strictEqual(Resp.decode(Resp.encodeBufBulk(Buffer.from('123'))), '123')
        assert.strictEqual(Resp.decode(Resp.encodeBufBulk(Buffer.from('123')), true).equals(Buffer.from('123')), true)

        assert.deepEqual(Resp.decode(Resp.encodeArray([])), [])
        assert.deepEqual(Resp.decode(Resp.encodeArray([[], [[]]])), [[], [[]]])
        assert.deepEqual(Resp.decode(Resp.encodeArray([Resp.encodeNull(), Resp.encodeInteger(123)])), [null, 123])
        assert.deepEqual(Resp.decode(Resp.encodeArray([Resp.encodeNull(), Resp.encodeInteger(123)]), true), [null, 123])

        assert.deepEqual(Resp.decode(Resp.encodeRequest(['set', 'key', 123])), ['set', 'key', '123'])
        assert.deepEqual(Resp.decode(Resp.encodeRequest(['set', 'key', 123]), true),
          [Buffer.from('set'), Buffer.from('key'), Buffer.from('123')])

        assert.throws(function () { Resp.decode() })
        assert.throws(function () { Resp.decode(null) })
        assert.throws(function () { Resp.decode(1) })
        assert.throws(function () { Resp.decode(Buffer.from('123')) })
        assert.throws(function () {
          let buf = Resp.encodeBulk('123')
          buf[buf.length - 1] = 0
          Resp.decode(buf)
        })
        assert.throws(function () {
          let buf = Buffer.concat([Resp.encodeBulk('123'), Buffer.from('1')])
          Resp.decode(buf)
        })
      })

      tman.it('new Resp()', function (done) {
        let result = []
        let reply = new Resp()

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

      tman.it('new Resp({bufBulk: true})', function (done) {
        let reply = new Resp({bufBulk: true})

        reply
          .on('data', function (data) {
            assert.strictEqual(Buffer.isBuffer(data), true)
          })
          .on('finish', done)

        reply.write(Buffer.from('$6\r\n中文\r\n'))
        reply.write(Resp.encodeBulk('abc'))
        reply.end()
      })

      tman.it('new Resp(): Pipelining data', function (done) {
        let result = []
        let reply = new Resp()

        reply
          .on('data', function (data) {
            result.push(data)
          })
          .on('finish', function () {
            assert.deepEqual(result, ['中文', '', '123'])
            done()
          })

        reply.write(Buffer.from('$6\r\n中文\r\n$0'))
        reply.write(Buffer.from('\r\n\r\n'))
        reply.write(Resp.encodeBulk(123))
        reply.end()
      })

      tman.it('new Resp(): with non resp buffer', function (done) {
        let reply = new Resp()

        reply
          .on('error', function (error) {
            assert.strictEqual(error instanceof Error, true)
            assert.strictEqual(error.message, 'Invalid Chunk: parse failed')
            done()
          })

        reply.write(Buffer.from('non resp buffer'))
      })

      tman.it('new Resp(): with error data', function (done) {
        let result = []
        let reply = new Resp()

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

        reply.write(Buffer.from('$6\r\n中文1\r\n$0'))
        reply.write(Buffer.from('\r\n\r\n'))
        reply.write(Resp.encodeBulk('123'))
        reply.end()
      })

      tman.it('new Resp(): chaos', function (done) {
        this.timeout(100000)

        let result = []
        let reply = new Resp()
        let buf = Resp.encodeArray([
          Resp.encodeNull(),
          Resp.encodeString('OKOKOKOK'),
          Resp.encodeInteger(123456789),
          Resp.encodeBulk('message'),
          Resp.encodeBufBulk(Buffer.from('buf')),
          Resp.encodeRequest(['set', 'key', '123正正abc'])
        ])
        let bufs = []
        for (let i = 0; i < 10000; i++) bufs.push(buf)
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

        let start = 0
        let length = bufs.length
        consumer()

        function consumer () {
          if (start >= length) return reply.end()
          let end = start + Math.ceil(Math.random() * 100)
          if (end > length) end = length
          reply.write(bufs.slice(start, end))
          start = end
          setTimeout(consumer, 0)
        }
      })

      tman.it('new Resp(): bench', function (done) {
        this.timeout(100000)

        let result = []
        let reply = new Resp()

        let buf = Resp.encodeArray([
          Resp.encodeString('OK'),
          Resp.encodeString('QUEUED'),
          Resp.encodeString('QUEUED'),
          Resp.encodeArray([Resp.encodeString('OK'), Resp.encodeInteger(1)])
        ])
        let bufs = []
        for (let i = 0; i < 10000; i++) bufs.push(buf)
        bufs = Buffer.concat(bufs)

        reply
          .on('data', function (data) {
            assert.deepEqual(data, ['OK', 'QUEUED', 'QUEUED', ['OK', 1]])
            result.push(data)
          })
          .on('finish', function () {
            assert.strictEqual(result.length, 10000)
            console.timeEnd('time')
            done()
          })
        console.time('time')
        reply.write(bufs)
        reply.end()
      })
    })
  })
}
