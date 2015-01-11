RESP.js
====
An implementation of REdis Serialization Protocol (RESP).

[![NPM version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]

## Install

Install with [npm](https://npmjs.org/package/respjs)

```
npm install respjs
```


## Usage


## API

```js
var resp = require('respjs');
```


### resp.bufferify(value)

Encode `value` to RESP buffer.

### resp.stringify(value, forceBulkStrings)

Encode `value` to RESP string.

### resp.parse(string, returnBuffers)

Decode RESP `string` to value.

### resp.Resp(options)

return a eventEmitter, then feed one or more buffers and decode to some value.

```js
var respEventEmitter = new resp.Resp({
  expectResCount: 10,
  returnBuffers: true
})
```

#### Options.expectResCount

*Optional*, Type: `Number`, Default: `Number.MAX_VALUE`.


#### Options.returnBuffers

*Optional*, Type: `Boolean`, Default: `false`.


### respEventEmitter.feed(buffer)
### respEventEmitter.setAutoEnd(resCount)

### respEventEmitter.on('data', function (redisReplyData) {})
### respEventEmitter.on('error', function (error) {})
### respEventEmitter.on('wait', function () {})
### respEventEmitter.on('end', function () {})


## License

MIT © [zensh](https://github.com/zensh)

[npm-url]: https://npmjs.org/package/resp.js
[npm-image]: http://img.shields.io/npm/v/resp.js.svg

[travis-url]: https://travis-ci.org/zensh/resp.js
[travis-image]: http://img.shields.io/travis/zensh/resp.js.svg
