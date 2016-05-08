'use strict'

const net = require('net')
const tman = require('tman')
const EventEmitter = require('events').EventEmitter
const assert = require('assert')
const Resp = require('..')

// Client 只能用于单返回值的 redis commands，不能用于多返回值的 Pub/Sub commands 和 monitor。
class Client extends EventEmitter {
  constructor () {
    super()
    this._queue = []
    this._resp = new Resp()
      .on('error', (error) => this.emit('error', error))
      .on('data', (data) => {
        let commandCallback = this._queue.shift()
        if (!commandCallback) return this.emit('error', new Error('Unexpected reply: ' + data))
        if (data instanceof Error) commandCallback(data)
        else commandCallback(null, data)
      })
    this._socket = net.createConnection.apply(null, arguments)
      .on('connect', () => this.emit('connect'))
      .on('error', (error) => this.emit('error', error))
      .on('close', () => this.emit('close'))
      .on('end', () => this.emit('end'))

    this._socket.pipe(this._resp)
  }

  cmd (args) {
    if (!Array.isArray(args)) args = Array.prototype.slice.call(arguments)
    if (['psubscribe', 'punsubscribe', 'subscribe', 'unsubscribe', 'monitor'].indexOf(args[0].toLowerCase()) !== -1) {
      throw new Error('Unsupport command: ' + args[0])
    }
    return (callback) => {
      this._queue.push(callback)
      this._socket.write(Resp.encodeRequest(args))
    }
  }
}

// tman example/redis_client.js
tman('simple redis client', function () {
  let client = new Client(6379)

  tman.it('info', function * () {
    let res = yield client.cmd('info')
    console.log('INFO:', res)
    assert.ok(res.indexOf('redis_version') > 0)
  })

  tman.it('set', function * () {
    let res = yield client.cmd('set', 'resp', 'hello')
    console.log('SET:', res)
    assert.strictEqual(res, 'OK')
  })

  tman.it('get', function * () {
    let res = yield client.cmd('get', 'resp')
    console.log('GET:', res)
    assert.strictEqual(res, 'hello')
  })

  tman.it('ping', function * () {
    let count = 10000
    let time = Date.now()
    while (count--) {
      let res = yield client.cmd('ping')
      assert.strictEqual(res, 'PONG')
    }
    console.log('PING:', (10000 * 1000 / (Date.now() - time)).toFixed(2), 'ops/sec')
  })
})
