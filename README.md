RESP v0.3.0 [![Build Status](https://travis-ci.org/zensh/resp.js.svg)](https://travis-ci.org/zensh/resp.js)
====
> An implementation of REdis Serialization Protocol (RESP).

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

### respEventEmitter.on('data', function (redisReplyData) {})
### respEventEmitter.on('error', function (error) {})
### respEventEmitter.on('wait', function () {})
### respEventEmitter.on('end', function () {})


## License

MIT © [zensh](https://github.com/zensh)
