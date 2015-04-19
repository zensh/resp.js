'use strict';
/*global describe, it, before, after, beforeEach, afterEach*/

var assert = require('assert');
var resp = require('../index.js');

function bufferEql(buffer1, buffer2) {
  if (!Buffer.isBuffer(buffer1) || !Buffer.isBuffer(buffer2)) return false;
  if (buffer1.length !== buffer2.length) return false;
  for (var i = 0; i < buffer1.length; i++) {
    if (buffer1[i] !== buffer2[i]) return false;
  }
  return true;
}

describe('resp.js', function() {
  it('resp.stringify(obj)', function(done) {
    assert.strictEqual(resp.stringify(null), '$-1\r\n');
    assert.strictEqual(resp.stringify(NaN), '$-1\r\n');
    assert.strictEqual(resp.stringify(''), '+\r\n');
    assert.strictEqual(resp.stringify('1'), '+1\r\n');
    assert.strictEqual(resp.stringify('中文'), '+中文\r\n');
    assert.strictEqual(resp.stringify(99), ':99\r\n');
    assert.strictEqual(resp.stringify(-99), ':-99\r\n');
    assert.strictEqual(resp.stringify(new Error('error')), '-Error error\r\n');
    var err = new Error('error');
    err.type = 'ERR';
    assert.strictEqual(resp.stringify(err), '-ERR error\r\n');
    assert.strictEqual(resp.stringify([]), '*0\r\n');
    assert.strictEqual(resp.stringify([[1, 2, 3], ['Foo']]), '*2\r\n*3\r\n:1\r\n:2\r\n:3\r\n*1\r\n+Foo\r\n');
    assert.strictEqual(resp.stringify(['foo', null, 'bar']), '*3\r\n+foo\r\n$-1\r\n+bar\r\n');
    assert.throws(function() { resp.stringify({}); });
    assert.throws(function() { resp.stringify(new Buffer('123')); });
    assert.throws(function() { resp.stringify([1, {}]); });
    assert.throws(function() { resp.stringify(new Date()); });
    done();
  });

  it('resp.stringify(obj, true)', function(done) {
    assert.strictEqual(resp.stringify('', true), '$0\r\n\r\n');
    assert.strictEqual(resp.stringify('1', true), '$1\r\n1\r\n');
    assert.strictEqual(resp.stringify('中文', true), '$6\r\n中文\r\n');
    assert.strictEqual(resp.stringify(99, true), '$2\r\n99\r\n');
    assert.strictEqual(resp.stringify(-99, true), '$3\r\n-99\r\n');
    assert.strictEqual(resp.stringify(new Error('error'), true), '-Error error\r\n');
    assert.strictEqual(resp.stringify([], true), '*0\r\n');
    assert.strictEqual(resp.stringify([[1, 2, 3], ['Foo']], true), '*2\r\n*3\r\n$1\r\n1\r\n$1\r\n2\r\n$1\r\n3\r\n*1\r\n$3\r\nFoo\r\n');
    assert.throws(function() { resp.stringify(NaN, true); });
    assert.throws(function() { resp.stringify(null, true); });
    assert.throws(function() { resp.stringify(['foo', null, 'bar'], true); });
    done();
  });

  it('resp.bufferify(obj)', function(done) {
    assert.strictEqual(bufferEql(resp.bufferify(''), new Buffer('$0\r\n\r\n')), true);
    assert.strictEqual(bufferEql(resp.bufferify('1'), new Buffer('$1\r\n1\r\n')), true);
    assert.strictEqual(bufferEql(resp.bufferify('中文'), new Buffer('$6\r\n中文\r\n')), true);
    assert.strictEqual(bufferEql(resp.bufferify(99), new Buffer('$2\r\n99\r\n')), true);
    assert.strictEqual(bufferEql(resp.bufferify(-99), new Buffer('$3\r\n-99\r\n')), true);
    assert.strictEqual(bufferEql(resp.bufferify(new Error('error')), new Buffer('-Error error\r\n')), true);
    assert.strictEqual(bufferEql(resp.bufferify([]), new Buffer('*0\r\n')), true);
    assert.strictEqual(bufferEql(resp.bufferify([[1, 2, 3], ['Foo']]), new Buffer('*2\r\n*3\r\n$1\r\n1\r\n$1\r\n2\r\n$1\r\n3\r\n*1\r\n$3\r\nFoo\r\n')), true);
    assert.strictEqual(bufferEql(resp.bufferify(new Buffer('中文')), new Buffer('$6\r\n中文\r\n')), true);
    assert.throws(function() { resp.bufferify({}); });
    assert.throws(function() { resp.bufferify(NaN); });
    assert.throws(function() { resp.bufferify(null); });
    assert.throws(function() { resp.bufferify([1, {}]); });
    assert.throws(function() { resp.bufferify([null, new Buffer('\x01\x02\x03')]); });
    assert.throws(function() { resp.bufferify(['foo', null, 'bar']); });
    done();
  });

  it('resp.parse(str)', function(done) {
    assert.strictEqual(resp.parse('$-1\r\n'), null);
    assert.strictEqual(resp.parse('+\r\n'), '');
    assert.strictEqual(resp.parse('$0\r\n\r\n'), '');
    assert.strictEqual(resp.parse('+1\r\n'), '1');
    assert.strictEqual(resp.parse('+中文\r\n'), '中文');
    assert.strictEqual(resp.parse(':99\r\n'), 99);
    assert.strictEqual(resp.parse(':-99\r\n'), -99);
    assert.strictEqual(resp.parse('-Error: error\r\n') instanceof Error, true);
    assert.deepEqual(resp.parse('*0\r\n'), []);
    assert.deepEqual(resp.parse('*2\r\n*3\r\n:1\r\n:2\r\n:3\r\n*2\r\n+Foo\r\n+Bar\r\n'), [[1, 2, 3], ['Foo', 'Bar']]);
    assert.deepEqual(resp.parse('*3\r\n+foo\r\n$-1\r\n+bar\r\n'), ['foo', null, 'bar']);
    var buf = resp.parse('$6\r\n中文\r\n', true);
    assert.strictEqual(buf.length, 6);
    assert.strictEqual(buf.toString(), '中文');
    assert.throws(function() { resp.parse('abc'); });
    assert.throws(function() { resp.parse('$-11\r\n'); });
    assert.throws(function() { resp.parse(':a\r\n'); });
    assert.throws(function() { resp.parse(':1\r\n1'); });
    assert.throws(function() { resp.parse('*2\r\n*3\r\n:1\r\n:2\r\n:3\r\n*2\r\n+Foo\r\n+Bar\r\n123'); });
    done();
  });

  it('resp.parse(resp.stringify(obj))', function(done) {
    assert.strictEqual(resp.parse(resp.stringify(null)), null);
    assert.strictEqual(resp.parse(resp.stringify(1)), 1);
    assert.strictEqual(resp.parse(resp.stringify('1')), '1');
    assert.strictEqual(resp.parse(resp.stringify('中文')), '中文');
    assert.deepEqual(resp.parse(resp.stringify([])), []);
    assert.deepEqual(resp.parse(resp.stringify([[[]]])), [[[]]]);
    assert.deepEqual(resp.parse(resp.stringify([1, '2', ['3']])), [1, '2', ['3']]);
    done();
  });

  it('resp.parse(resp.bufferify(obj))', function(done) {
    assert.strictEqual(resp.parse(resp.bufferify(1)), '1');
    assert.strictEqual(resp.parse(resp.bufferify('1')), '1');
    assert.strictEqual(resp.parse(resp.bufferify('中文')), '中文');
    assert.deepEqual(resp.parse(resp.bufferify([])), []);
    assert.deepEqual(resp.parse(resp.bufferify([[[]]])), [[[]]]);
    assert.deepEqual(resp.parse(resp.bufferify([1, '2', ['3']])), ['1', '2', ['3']]);
    assert.deepEqual(resp.parse(resp.bufferify([1, new Buffer('中文')])), ['1', '中文']);
    var buf = new Buffer('中文');
    var res = resp.parse(resp.bufferify([1, buf]), true);
    assert.equal(res[0], '1');
    // no `equals` method in v0.10.x
    if (buf.equals) assert.equal(buf.equals(res[1]), true);
    assert.throws(function() { resp.parse(resp.bufferify(null)); });
    done();
  });

  it('resp.Resp()', function(done) {
    var result = [];
    var reply = resp.Resp();

    reply
      .on('data', function(data) {
        result.push(data);
        if (result.length === 6) reply.feed(null);
      })
      .on('end', function() {
        assert.deepEqual(result, ['0', '2', '', '中文', [], [[]]]);
        done();
      });

    reply.feed(resp.bufferify(0));
    reply.feed(resp.bufferify('2'));
    reply.feed(resp.bufferify(''));
    reply.feed(resp.bufferify('中文'));
    reply.feed(resp.bufferify([]));
    reply.feed(resp.bufferify([[]]));
  });

  it('resp.Resp({expectResCount: 3})', function(done) {
    var result = [];
    var reply = resp.Resp({expectResCount: 3});

    reply
      .on('data', function(data) {
        result.push(data);
      })
      .on('end', function() {
        assert.deepEqual(result, ['中文', ['1', [], '2'], [['1']]]);
        done();
      });

    reply.feed(resp.bufferify('中文'));
    reply.feed(resp.bufferify([1, [], '2']));
    reply.feed(resp.bufferify([[1]]));
  });

  it('resp.Resp({returnBuffers: true})', function(done) {
    var reply = resp.Resp({expectResCount: 2, returnBuffers: true});

    reply
      .on('data', function(data) {
        assert.strictEqual(Buffer.isBuffer(data), true);
      })
      .on('end', done);

    reply.feed(new Buffer('$6\r\n中文\r\n'));
    reply.feed(resp.bufferify('abc'));
  });

  it('resp.Resp():Pipelining data', function(done) {
    var result = [];
    var reply = resp.Resp({expectResCount: 3});

    reply
      .on('data', function(data) {
        result.push(data);
      })
      .on('end', function() {
        assert.deepEqual(result, ['中文', '', '123']);
        done();
      });

    reply.feed(new Buffer('$6\r\n中文\r\n$0'));
    reply.feed(new Buffer('\r\n\r\n'));
    reply.feed(resp.bufferify(123));
  });

  it('resp.Resp():with error data', function(done) {
    var result = [];
    var reply = resp.Resp({expectResCount: 3});

    reply
      .on('data', function(data) {
        result.push(data);
      })
      .on('error', function(error) {
        result.push('');
      })
      .on('end', function() {
        assert.deepEqual(result, ['', '', '123']);
        done();
      });

    reply.feed(new Buffer('$6\r\n中文1\r\n$0'));
    reply.feed(new Buffer('\r\n\r\n'));
    reply.feed(resp.bufferify(123));
  });
});
