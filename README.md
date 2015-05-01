RESP.js
====
An implementation of REdis Serialization Protocol (RESP), parse pipelining chunks.

[![NPM version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]

## Implementations:

- [thunk-redis](https://github.com/thunks/thunk-redis): A redis client with pipelining, rely on thunks, support promise.

## Install

Install with [npm](https://npmjs.org/package/respjs)

```
npm install respjs
```

## Usage


## API

```js
var Resp = require('respjs');
```

### Class Resp

#### new Resp([options])

Resp is a EventEmitter similar to `Writable` stream. It accept pipelining socket chunks, parse them, produce redis response data. `Readable` stream can be piped to `resp`.

- `options` {Object}
  - `returnBuffers` {Boolean} return buffers, default to `false`

```js
var resp = new Resp({
  returnBuffers: true
});
```

### Resp.bufferify(value)

Encode `value` to `RESP` buffer.

### Resp.stringify(value, forceBulkStrings)

Encode `value` to `RESP` string.

### Resp.parse(string, returnBuffers)

Decode `RESP` `string` to value.

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

## License

MIT © [zensh](https://github.com/zensh)

[npm-url]: https://npmjs.org/package/respjs
[npm-image]: http://img.shields.io/npm/v/respjs.svg

[travis-url]: https://travis-ci.org/zensh/resp.js
[travis-image]: http://img.shields.io/travis/zensh/resp.js.svg
