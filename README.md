# RESP.js

An implementation of REdis Serialization Protocol (RESP).

[![NPM version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]
[![Downloads][downloads-image]][downloads-url]

## Rust version: https://github.com/iorust/resp

## Golang version: https://github.com/teambition/respgo

## Implementations:

- [thunk-redis](https://github.com/thunks/thunk-redis): A redis client with pipelining, rely on thunks, support promise.
- [thunk-disque](https://github.com/thunks/thunk-disque): A thunk/promise-based disque client.
- [snapper-core](https://github.com/teambition/snapper-core): Teambition push messaging service, backed by redis.
- [snapper-producer](https://github.com/teambition/snapper-producer): Snapper producer client for node.js.

## Install

Install with [npm](https://npmjs.org/package/respjs)

```
npm install respjs
```

## Usage

simple redis client (with test):
https://github.com/zensh/resp.js/blob/master/example/redis_client.js

Run:
```sh
npm run example
```

## API

```js
const Resp = require('respjs')
```

### Class Resp

#### new Resp([options])

Resp is a EventEmitter similar to `Writable` stream. It accept pipelining socket chunks, parse them, produce redis response data. `Readable` stream can be piped to `resp`.

- `options` {Object}
- `bufBulk` {Boolean} return buffers for bulk reply, default to `false`

```js
const resp = new Resp({
  bufBulk: true
})
```

#### resp.write(chunk)

Feed chunk and parse it. resp will emit `data` event while a integrated data decoded.

#### resp.end([chunk])

Call this method when no more chunk will be written to bufsp, then `finish` event emit.

#### Event: 'error'

- `error` {Error}

Emitted when an error occurs.

#### Event: 'data'

- `data` {Mixed}

Emitted when redis response data produced.

#### Event: 'drain'

Emitted when chunk have been parsed or need more chunks for parsing.

#### Event: 'finish'

The `finish` event is fired after `.end()` is called and all chunks have been processed.

### Class Method: Resp.decode(buffer, bufBulk)

Decode RESP's buffer to RESP value.

```js
Resp.decode(Resp.encodeNull()) // null
Resp.decode(Resp.encodeString('123')) // '123'
Resp.decode(Resp.encodeInteger(123)) // 123
Resp.decode(Resp.encodeBulk(123)) // '123'
```

### Class Method: Resp.encodeRequest([value, ...])

Encode a array of value to one `RESP` buffer. It is usefull to encode a request.

```js
let buf = Resp.encodeRequest(['set', 'key', 123])
// <Buffer 2a 33 0d 0a 24 33 0d 0a 73 65 74 0d 0a 24 33 0d 0a 6b 65 79 0d 0a 24 33 0d 0a 31 32 33 0d 0a>
let str = buf.toString() // *3\r\n$3\r\nset\r\n$3\r\nkey\r\n$3\r\n123\r\n

Resp.encodeRequest(['set', 'key', new Buffer('123')]) // support buffer!
```

### Class Method: Resp.encodeNull()

Encode RESP's Null value to `RESP` buffer.

```js
let buf = Resp.encodeNull() // <Buffer 24 2d 31 0d 0a>
let str = buf.toString() // $-1\r\n
```

### Class Method: Resp.encodeNullArray()

Encode RESP's Null Array value to `RESP` buffer.

```js
let buf = Resp.encodeNull() // <Buffer 2a 2d 31 0d 0a>
let str = buf.toString() // *-1\r\n
```

### Class Method: Resp.encodeString(str)

Encode string to `RESP` buffer.

```js
let buf = Resp.encodeString('OK') // <Buffer 2b 4f 4b 0d 0a>
let str = buf.toString() // +OK\r\n
```

### Class Method: Resp.encodeError(error)

Encode error object to `RESP` buffer.

```js
let buf = Resp.encodeError(new Error('error')) // <Buffer 2d 45 72 72 6f 72 20 65 72 72 6f 72 0d 0a>
let str = buf.toString() // -Error error\r\n
```

### Class Method: Resp.encodeInteger(num)

Encode integer to `RESP` buffer.

```js
let buf = Resp.encodeInteger(123) // <Buffer 3a 31 32 33 0d 0a>
let str = buf.toString() // :123\r\n
```

### Class Method: Resp.encodeBulk(str)

Encode RESP's bulk string to `RESP` buffer.

```js
let buf = Resp.encodeBulk('message') // <Buffer 24 37 0d 0a 6d 65 73 73 61 67 65 0d 0a>
let str = buf.toString() // $7\r\nmessage\r\n
```

### Class Method: Resp.encodeBufBulk(buf)

Encode RESP's bulk buffer to `RESP` buffer.

```js
let buf = Resp.encodeBufBulk(new Buffer('buf')) // <Buffer 24 33 0d 0a 62 75 66 0d 0a>
let str = buf.toString() // $3\r\nbuf\r\n
```

### Class Method: Resp.encodeArray([RESP_buffer, ...])

Encode a array of RESP' value buffer to one `RESP` buffer.

```js
let buf = Resp.encodeArray([Resp.encodeNull(), Resp.encodeString('OK')])
// <Buffer 2a 32 0d 0a 24 2d 31 0d 0a 2b 4f 4b 0d 0a>
let str = buf.toString() // *2\r\n$-1\r\n+OK\r\n
```

## License

MIT © [zensh](https://github.com/zensh)

[npm-url]: https://npmjs.org/package/respjs
[npm-image]: http://img.shields.io/npm/v/respjs.svg

[travis-url]: https://travis-ci.org/zensh/resp.js
[travis-image]: http://img.shields.io/travis/zensh/resp.js.svg

[downloads-url]: https://npmjs.org/package/respjs
[downloads-image]: http://img.shields.io/npm/dm/respjs.svg?style=flat-square
