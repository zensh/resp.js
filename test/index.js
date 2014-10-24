'use strict';
/*global describe, it, before, after, beforeEach, afterEach*/

var should = require('should'),
  thunkStream = require('thunk-stream'),
  resp = require('../index.js'),
  stream = require('stream');

describe('resp.js', function () {
  it('resp.stringify(obj)', function (done) {
    should(resp.stringify(null)).be.equal('$-1\r\n');
    should(resp.stringify(NaN)).be.equal('$-1\r\n');
    should(resp.stringify('')).be.equal('+\r\n');
    should(resp.stringify('1')).be.equal('+1\r\n');
    should(resp.stringify('中文')).be.equal('+中文\r\n');
    should(resp.stringify(99)).be.equal(':99\r\n');
    should(resp.stringify(-99)).be.equal(':-99\r\n');
    should(resp.stringify(new Error('error'))).be.equal('-Error: error\r\n');
    should(resp.stringify([])).be.equal('*0\r\n');
    should(resp.stringify([[1, 2, 3], ['Foo', new Error('Bar')]])).be.equal('*2\r\n*3\r\n:1\r\n:2\r\n:3\r\n*2\r\n+Foo\r\n-Error: Bar\r\n');
    should(resp.stringify(['foo', null, 'bar'])).be.equal('*3\r\n+foo\r\n$-1\r\n+bar\r\n');
    should(resp.stringify(new Buffer('中文'))).be.equal('$6\r\n中文\r\n');
    should(resp.stringify(new Buffer(0))).be.equal('$0\r\n\r\n');
    should(function () { resp.stringify({}); }).throw();
    should(function () { resp.stringify([1, {}]); }).throw();
    should(function () { resp.stringify(new Date()); }).throw();
    done();
  });

  it('resp.parse(str)', function (done) {
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
    should(function () { resp.parse('abc'); }).throw();
    should(function () { resp.parse('$-11\r\n'); }).throw();
    should(function () { resp.parse(':a\r\n'); }).throw();
    should(function () { resp.parse(':1\r\n1'); }).throw();
    should(function () { resp.parse('*2\r\n*3\r\n:1\r\n:2\r\n:3\r\n*2\r\n+Foo\r\n+Bar\r\n123'); }).throw();
    done();
  });

  it('resp.parse(resp.stringify(obj))', function (done) {
    should(resp.parse(resp.stringify(null))).be.equal(null);
    should(resp.parse(resp.stringify(1))).be.equal(1);
    should(resp.parse(resp.stringify('1'))).be.equal('1');
    should(resp.parse(resp.stringify('中文'))).be.equal('中文');
    should(resp.parse(resp.stringify([]))).be.eql([]);
    should(resp.parse(resp.stringify([[[]]]))).be.eql([[[]]]);
    should(resp.parse(resp.stringify([1, '2', ['3']]))).be.eql([1, '2', ['3']]);
    var buf = resp.parse(resp.stringify(new Buffer(0)), true);
    should(buf.length).be.equal(0);
    should(buf.toString()).be.equal('');
    done();
  });

  it('resp.Resp()', function (done) {
    var result = [];
    var stream = resp.Resp();
    thunkStream(stream)(function () {
      should(result).be.eql([0, '2', '', '中文', [], [[]]]);
    })(done);

    stream.on('data', function (data) {
      result.push(data);
      if (result.length === 6) stream.feed(null);
    });

    stream.feed(new Buffer(resp.stringify(0)));
    stream.feed(new Buffer(resp.stringify('2')));
    stream.feed(new Buffer(resp.stringify('')));
    stream.feed(new Buffer(resp.stringify('中文')));
    stream.feed(new Buffer(resp.stringify([])));
    stream.feed(new Buffer(resp.stringify([[]])));
  });

  it('resp.Resp({expectResCount: 3})', function (done) {
    var result = [];
    var stream = resp.Resp({expectResCount: 3});
    thunkStream(stream)(function () {
      should(result).be.eql(['中文', [1, null, '2'], [[null]]]);
    })(done);

    stream.on('data', function (data) {
      result.push(data);
    });

    stream.feed(new Buffer(resp.stringify('中文')));
    stream.feed(new Buffer(resp.stringify([1, null, '2'])));
    stream.feed(new Buffer(resp.stringify([[null]])));
  });
});
