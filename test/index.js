'use strict';
/*global describe, it, before, after, beforeEach, afterEach*/

var assert = require('assert');
var Resp = require('../index.js');

if (!Buffer.prototype.equals) {
  Buffer.prototype.equals = function(buffer) {
    if (!Buffer.isBuffer(buffer)) return false;
    if (this.length !== buffer.length) return false;
    for (var i = 0; i < this.length; i++) {
      if (this[i] !== buffer[i]) return false;
    }
    return true;
  };
}


describe('Resp.js', function() {
  it('Resp.stringify(obj)', function(done) {
    assert.strictEqual(Resp.stringify(null), '$-1\r\n');
    assert.strictEqual(Resp.stringify(NaN), '$-1\r\n');
    assert.strictEqual(Resp.stringify(''), '+\r\n');
    assert.strictEqual(Resp.stringify('1'), '+1\r\n');
    assert.strictEqual(Resp.stringify('中文'), '+中文\r\n');
    assert.strictEqual(Resp.stringify(99), ':99\r\n');
    assert.strictEqual(Resp.stringify(-99), ':-99\r\n');
    assert.strictEqual(Resp.stringify(new Error('error')), '-Error error\r\n');
    var err = new Error('error');
    err.name = 'ERR';
    assert.strictEqual(Resp.stringify(err), '-ERR error\r\n');
    assert.strictEqual(Resp.stringify([]), '*0\r\n');
    assert.strictEqual(Resp.stringify([[1, 2, 3], ['Foo']]), '*2\r\n*3\r\n:1\r\n:2\r\n:3\r\n*1\r\n+Foo\r\n');
    assert.strictEqual(Resp.stringify(['foo', null, 'bar']), '*3\r\n+foo\r\n$-1\r\n+bar\r\n');
    assert.throws(function() { Resp.stringify({}); });
    assert.throws(function() { Resp.stringify(new Buffer('123')); });
    assert.throws(function() { Resp.stringify([1, {}]); });
    assert.throws(function() { Resp.stringify(new Date()); });
    done();
  });

  it('Resp.stringify(obj, true)', function(done) {
    assert.strictEqual(Resp.stringify('', true), '$0\r\n\r\n');
    assert.strictEqual(Resp.stringify('1', true), '$1\r\n1\r\n');
    assert.strictEqual(Resp.stringify('中文', true), '$6\r\n中文\r\n');
    assert.strictEqual(Resp.stringify(99, true), '$2\r\n99\r\n');
    assert.strictEqual(Resp.stringify(-99, true), '$3\r\n-99\r\n');
    assert.strictEqual(Resp.stringify(new Error('error'), true), '-Error error\r\n');
    assert.strictEqual(Resp.stringify([], true), '*0\r\n');
    assert.strictEqual(Resp.stringify([[1, 2, 3], ['Foo']], true), '*2\r\n*3\r\n$1\r\n1\r\n$1\r\n2\r\n$1\r\n3\r\n*1\r\n$3\r\nFoo\r\n');
    assert.throws(function() { Resp.stringify(NaN, true); });
    assert.throws(function() { Resp.stringify(null, true); });
    assert.throws(function() { Resp.stringify(['foo', null, 'bar'], true); });
    done();
  });

  it('Resp.bufferify(obj)', function(done) {
    assert.strictEqual(Resp.bufferify('').equals(new Buffer('$0\r\n\r\n')), true);
    assert.strictEqual(Resp.bufferify('1').equals(new Buffer('$1\r\n1\r\n')), true);
    assert.strictEqual(Resp.bufferify('中文').equals(new Buffer('$6\r\n中文\r\n')), true);
    assert.strictEqual(Resp.bufferify(99).equals(new Buffer('$2\r\n99\r\n')), true);
    assert.strictEqual(Resp.bufferify(-99).equals(new Buffer('$3\r\n-99\r\n')), true);
    assert.strictEqual(Resp.bufferify(new Error('error')).equals(new Buffer('-Error error\r\n')), true);
    assert.strictEqual(Resp.bufferify([]).equals(new Buffer('*0\r\n')), true);
    assert.strictEqual(Resp.bufferify([[1, 2, 3], ['Foo']]).equals(new Buffer('*2\r\n*3\r\n$1\r\n1\r\n$1\r\n2\r\n$1\r\n3\r\n*1\r\n$3\r\nFoo\r\n')), true);
    assert.strictEqual(Resp.bufferify(new Buffer('中文')).equals(new Buffer('$6\r\n中文\r\n')), true);
    assert.throws(function() { Resp.bufferify({}); });
    assert.throws(function() { Resp.bufferify(NaN); });
    assert.throws(function() { Resp.bufferify(null); });
    assert.throws(function() { Resp.bufferify([1, {}]); });
    assert.throws(function() { Resp.bufferify([null, new Buffer('\x01\x02\x03')]); });
    assert.throws(function() { Resp.bufferify(['foo', null, 'bar']); });
    done();
  });

  it('Resp.parse(str)', function(done) {
    assert.strictEqual(Resp.parse('$-1\r\n'), null);
    assert.strictEqual(Resp.parse('+\r\n'), '');
    assert.strictEqual(Resp.parse('$0\r\n\r\n'), '');
    assert.strictEqual(Resp.parse('+1\r\n'), '1');
    assert.strictEqual(Resp.parse('+中文\r\n'), '中文');
    assert.strictEqual(Resp.parse(':99\r\n'), 99);
    assert.strictEqual(Resp.parse(':-99\r\n'), -99);
    assert.strictEqual(Resp.parse('-Error: error\r\n') instanceof Error, true);
    assert.deepEqual(Resp.parse('*0\r\n'), []);
    assert.deepEqual(Resp.parse('*2\r\n*3\r\n:1\r\n:2\r\n:3\r\n*2\r\n+Foo\r\n+Bar\r\n'), [[1, 2, 3], ['Foo', 'Bar']]);
    assert.deepEqual(Resp.parse('*3\r\n+foo\r\n$-1\r\n+bar\r\n'), ['foo', null, 'bar']);
    var buf = Resp.parse('$6\r\n中文\r\n', true);
    assert.strictEqual(buf.length, 6);
    assert.strictEqual(buf.toString(), '中文');
    assert.throws(function() { Resp.parse('abc'); });
    assert.throws(function() { Resp.parse('$-11\r\n'); });
    assert.throws(function() { Resp.parse(':a\r\n'); });
    assert.throws(function() { Resp.parse(':1\r\n1'); });
    assert.throws(function() { Resp.parse('*2\r\n*3\r\n:1\r\n:2\r\n:3\r\n*2\r\n+Foo\r\n+Bar\r\n123'); });
    done();
  });

  it('Resp.parse(Resp.stringify(obj))', function(done) {
    assert.strictEqual(Resp.parse(Resp.stringify(null)), null);
    assert.strictEqual(Resp.parse(Resp.stringify(1)), 1);
    assert.strictEqual(Resp.parse(Resp.stringify('1')), '1');
    assert.strictEqual(Resp.parse(Resp.stringify('中文')), '中文');
    assert.deepEqual(Resp.parse(Resp.stringify([])), []);
    assert.deepEqual(Resp.parse(Resp.stringify([[[]]])), [[[]]]);
    assert.deepEqual(Resp.parse(Resp.stringify([1, '2', ['3']])), [1, '2', ['3']]);
    done();
  });

  it('Resp.parse(Resp.bufferify(obj))', function(done) {
    assert.strictEqual(Resp.parse(Resp.bufferify(1)), '1');
    assert.strictEqual(Resp.parse(Resp.bufferify('1')), '1');
    assert.strictEqual(Resp.parse(Resp.bufferify('中文')), '中文');
    assert.deepEqual(Resp.parse(Resp.bufferify([])), []);
    assert.deepEqual(Resp.parse(Resp.bufferify([[[]]])), [[[]]]);
    assert.deepEqual(Resp.parse(Resp.bufferify([1, '2', ['3']])), ['1', '2', ['3']]);
    assert.deepEqual(Resp.parse(Resp.bufferify([1, new Buffer('中文')])), ['1', '中文']);
    var buf = new Buffer('中文');
    var res = Resp.parse(Resp.bufferify([1, buf]), true);
    assert.equal(res[0], '1');
    // no `equals` method in v0.10.x
    if (buf.equals) assert.equal(buf.equals(res[1]), true);
    assert.throws(function() { Resp.parse(Resp.bufferify(null)); });
    done();
  });

  it('Resp()', function(done) {
    var result = [];
    var reply = Resp();

    reply
      .on('data', function(data) {
        result.push(data);
      })
      .on('finish', function() {
        assert.deepEqual(result, ['0', '2', '', '中文', [], [[]]]);
        done();
      });

    reply.write(Resp.bufferify(0));
    reply.write(Resp.bufferify('2'));
    reply.write(Resp.bufferify(''));
    reply.write(Resp.bufferify('中文'));
    reply.write(Resp.bufferify([]));
    reply.write(Resp.bufferify([[]]));
    reply.end();
  });

  it('Resp({returnBuffers: true})', function(done) {
    var reply = Resp({returnBuffers: true});

    reply
      .on('data', function(data) {
        assert.strictEqual(Buffer.isBuffer(data), true);
      })
      .on('finish', done);

    reply.write(new Buffer('$6\r\n中文\r\n'));
    reply.write(Resp.bufferify('abc'));
    reply.end();
  });

  it('Resp():Pipelining data', function(done) {
    var result = [];
    var reply = Resp();

    reply
      .on('data', function(data) {
        result.push(data);
      })
      .on('finish', function() {
        assert.deepEqual(result, ['中文', '', '123']);
        done();
      });

    reply.write(new Buffer('$6\r\n中文\r\n$0'));
    reply.write(new Buffer('\r\n\r\n'));
    reply.write(Resp.bufferify(123));
    reply.end();
  });

  it('Resp():with non resp buffer', function(done) {
    var reply = Resp();

    reply
      .on('error', function(error) {
        assert.strictEqual(error instanceof Error, true);
        assert.strictEqual(error.message, 'Invalid Chunk: parse failed');
        done();
      });

    reply.write(new Buffer('non resp buffer'));
  });

  it('Resp():with error data', function(done) {
    var result = [];
    var reply = Resp();

    reply
      .on('data', function(data) {
        result.push(data);
      })
      .on('error', function(error) {
        result.push('');
      })
      .on('finish', function() {
        assert.deepEqual(result, ['', '', '123']);
        done();
      });

    reply.write(new Buffer('$6\r\n中文1\r\n$0'));
    reply.write(new Buffer('\r\n\r\n'));
    reply.write(Resp.bufferify('123'));
    reply.end();
  });
});
