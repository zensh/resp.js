'use strict';
/*global describe, it, before, after, beforeEach, afterEach*/

var should = require('should'),
  resp = require('../index.js');

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
    should(resp.stringify(null)).be.equal('$-1\r\n');
    should(resp.stringify(NaN)).be.equal('$-1\r\n');
    should(resp.stringify('')).be.equal('+\r\n');
    should(resp.stringify('1')).be.equal('+1\r\n');
    should(resp.stringify('中文')).be.equal('+中文\r\n');
    should(resp.stringify(99)).be.equal(':99\r\n');
    should(resp.stringify(-99)).be.equal(':-99\r\n');
    should(resp.stringify(new Error('error'))).be.equal('-Error: error\r\n');
    should(resp.stringify([])).be.equal('*0\r\n');
    should(resp.stringify([[1, 2, 3], ['Foo']])).be.equal('*2\r\n*3\r\n:1\r\n:2\r\n:3\r\n*1\r\n+Foo\r\n');
    should(resp.stringify(['foo', null, 'bar'])).be.equal('*3\r\n+foo\r\n$-1\r\n+bar\r\n');
    // should(resp.stringify(new Buffer('中文'))).be.equal('$6\r\n中文\r\n');
    // should(resp.stringify(new Buffer(0))).be.equal('$0\r\n\r\n');
    should(function() { resp.stringify({}); }).throw();
    should(function() { resp.stringify(new Buffer('123')); }).throw();
    should(function() { resp.stringify([1, {}]); }).throw();
    should(function() { resp.stringify(new Date()); }).throw();
    done();
  });

  it('resp.stringify(obj, true)', function(done) {
    should(resp.stringify('', true)).be.equal('$0\r\n\r\n');
    should(resp.stringify('1', true)).be.equal('$1\r\n1\r\n');
    should(resp.stringify('中文', true)).be.equal('$6\r\n中文\r\n');
    should(resp.stringify(99, true)).be.equal('$2\r\n99\r\n');
    should(resp.stringify(-99, true)).be.equal('$3\r\n-99\r\n');
    should(resp.stringify(new Error('error'), true)).be.equal('-Error: error\r\n');
    should(resp.stringify([], true)).be.equal('*0\r\n');
    should(resp.stringify([[1, 2, 3], ['Foo']], true)).be.equal('*2\r\n*3\r\n$1\r\n1\r\n$1\r\n2\r\n$1\r\n3\r\n*1\r\n$3\r\nFoo\r\n');
    should(function() { resp.stringify(NaN, true); }).throw();
    should(function() { resp.stringify(null, true); }).throw();
    should(function() { resp.stringify(['foo', null, 'bar'], true); }).throw();
    done();
  });

  it('resp.bufferify(obj)', function(done) {
    should(bufferEql(resp.bufferify(''), new Buffer('$0\r\n\r\n'))).be.equal(true);
    should(bufferEql(resp.bufferify('1'), new Buffer('$1\r\n1\r\n'))).be.equal(true);
    should(bufferEql(resp.bufferify('中文'), new Buffer('$6\r\n中文\r\n'))).be.equal(true);
    should(bufferEql(resp.bufferify(99), new Buffer('$2\r\n99\r\n'))).be.equal(true);
    should(bufferEql(resp.bufferify(-99), new Buffer('$3\r\n-99\r\n'))).be.equal(true);
    should(bufferEql(resp.bufferify(new Error('error')), new Buffer('-Error: error\r\n'))).be.equal(true);
    should(bufferEql(resp.bufferify([]), new Buffer('*0\r\n'))).be.equal(true);
    should(bufferEql(resp.bufferify([[1, 2, 3], ['Foo']]), new Buffer('*2\r\n*3\r\n$1\r\n1\r\n$1\r\n2\r\n$1\r\n3\r\n*1\r\n$3\r\nFoo\r\n'))).be.equal(true);
    should(bufferEql(resp.bufferify(new Buffer('中文')), new Buffer('$6\r\n中文\r\n'))).be.equal(true);
    should(function() { resp.bufferify({}); }).throw();
    should(function() { resp.bufferify(NaN); }).throw();
    should(function() { resp.bufferify(null); }).throw();
    should(function() { resp.bufferify([1, {}]); }).throw();
    should(function() { resp.bufferify([null, new Buffer('\x01\x02\x03')]); }).throw();
    should(function() { resp.bufferify(['foo', null, 'bar']); }).throw();
    done();
  });

  it('resp.parse(str)', function(done) {
    should(resp.parse('$-1\r\n')).be.equal(null);
    should(resp.parse('+\r\n')).be.equal('');
    should(resp.parse('$0\r\n\r\n')).be.equal('');
    should(resp.parse('+1\r\n')).be.equal('1');
    should(resp.parse('+中文\r\n')).be.equal('中文');
    should(resp.parse(':99\r\n')).be.equal(99);
    should(resp.parse(':-99\r\n')).be.equal(-99);
    should(resp.parse('-Error: error\r\n')).be.instanceOf(Error);
    should(resp.parse('*0\r\n')).be.eql([]);
    should(resp.parse('*2\r\n*3\r\n:1\r\n:2\r\n:3\r\n*2\r\n+Foo\r\n+Bar\r\n')).be.eql([[1, 2, 3], ['Foo', 'Bar']]);
    should(resp.parse('*3\r\n+foo\r\n$-1\r\n+bar\r\n')).be.eql(['foo', null, 'bar']);
    var buf = resp.parse('$6\r\n中文\r\n', true);
    should(buf.length).be.equal(6);
    should(buf.toString()).be.equal('中文');
    should(function() { resp.parse('abc'); }).throw();
    should(function() { resp.parse('$-11\r\n'); }).throw();
    should(function() { resp.parse(':a\r\n'); }).throw();
    should(function() { resp.parse(':1\r\n1'); }).throw();
    should(function() { resp.parse('*2\r\n*3\r\n:1\r\n:2\r\n:3\r\n*2\r\n+Foo\r\n+Bar\r\n123'); }).throw();
    done();
  });

  it('resp.parse(resp.stringify(obj))', function(done) {
    should(resp.parse(resp.stringify(null))).be.equal(null);
    should(resp.parse(resp.stringify(1))).be.equal(1);
    should(resp.parse(resp.stringify('1'))).be.equal('1');
    should(resp.parse(resp.stringify('中文'))).be.equal('中文');
    should(resp.parse(resp.stringify([]))).be.eql([]);
    should(resp.parse(resp.stringify([[[]]]))).be.eql([[[]]]);
    should(resp.parse(resp.stringify([1, '2', ['3']]))).be.eql([1, '2', ['3']]);
    done();
  });

  it('resp.parse(resp.bufferify(obj))', function(done) {
    should(resp.parse(resp.bufferify(1))).be.equal('1');
    should(resp.parse(resp.bufferify('1'))).be.equal('1');
    should(resp.parse(resp.bufferify('中文'))).be.equal('中文');
    should(resp.parse(resp.bufferify([]))).be.eql([]);
    should(resp.parse(resp.bufferify([[[]]]))).be.eql([[[]]]);
    should(resp.parse(resp.bufferify([1, '2', ['3']]))).be.eql(['1', '2', ['3']]);
    should(resp.parse(resp.bufferify([1, new Buffer('中文')]))).be.eql(['1', '中文']);
    should(function() { resp.parse(resp.bufferify(null)); }).throw();
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
        should(result).be.eql(['0', '2', '', '中文', [], [[]]]);
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
        should(result).be.eql(['中文', ['1', [], '2'], [['1']]]);
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
        should(Buffer.isBuffer(data)).be.equal(true);
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
        should(result).be.eql(['中文', '', '123']);
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
        should(result).be.eql(['', '', '123']);
        done();
      });

    reply.feed(new Buffer('$6\r\n中文1\r\n$0'));
    reply.feed(new Buffer('\r\n\r\n'));
    reply.feed(resp.bufferify(123));
  });
});
