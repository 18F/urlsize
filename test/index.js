'use strict';
var urlsize = require('../'),
    cmd = './bin/urlsize.js',
    fs = require('fs'),
    path = require('path'),
    assert = require('assert'),
    child = require('child_process'),
    through2 = require('through2'),
    csv = require('fast-csv');

describe('api', function() {

  describe('urlsize.createReadStream()', function() {
    it('streams urls', function(done) {
      var str = urlsize.createReadStream()
        .on('data', function(d) {
          assert.ok(d, 'no url: ' + d);
          done();
        })
        .end('google.com');
    });
  });

  describe('urlsize()', function() {

    it('works without options', function(done) {
      urlsize('google.com', function(error, url) {
        assert.ok(!error, 'error: ' + error);
        assert.ok(typeof url === 'object', 'url is not an object: ' + (typeof url));
        assert.equal(url.url, 'http://google.com', 'no http:// prefix: ' + url);
        assert.ok(url.size.match(/kb$/i), 'bad size suffix: ' + url.size);
        done();
      });
    });

    it('works with options', function(done) {
      urlsize('google.com', {unix: true}, function(error, url) {
        assert.ok(!error, 'error: ' + error);
        assert.ok(typeof url === 'object', 'url is not an object: ' + (typeof url));
        assert.equal(url.url, 'http://google.com', 'no http:// prefix: ' + url);
        assert.ok(url.size.match(/K$/), 'bad unix size format: ' + url.size);
        done();
      });
    });

  });

  describe('urlsize.batch()', function() {

    it('takes multiple urls', function(done) {
      urlsize.batch(['google.com', 'yahoo.com'], function(error, urls) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(urls.length, 2, 'bad urls.length: ' + urls.length);
        done();
      });
    });

    it('takes multiple urls with options', function(done) {
      urlsize.batch(['google.com', 'yahoo.com'], {unix: true}, function(error, urls) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(urls.length, 2, 'bad urls.length: ' + urls.length);
        done();
      });
    });

    it('sorts by length descending', function(done) {
      var options = {sort: 'd'};
      urlsize.batch(['google.com', 'yahoo.com'], options, function(error, urls) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(urls.length, 2, 'bad urls.length: ' + urls.length);
        var sizes = urls.map(function(d) { return d.length; }),
            sorted = sizes.slice().sort(descending);
        assert.deepEqual(sizes, sorted, 'wrong sort order: ' + sizes);
        done();
      });
    });

    it('sorts by length ascending', function(done) {
      var options = {sort: true};
      urlsize.batch(['google.com', 'yahoo.com'], options, function(error, urls) {
        assert.ok(!error, 'error: ' + error);
        assert.equal(urls.length, 2, 'bad urls.length: ' + urls.length);
        var sizes = urls.map(function(d) { return d.length; }),
            sorted = sizes.slice().sort(ascending);
        assert.deepEqual(sizes, sorted, 'wrong sort order: ' + sizes);
        done();
      });
    });

  });

});

describe('cli', function() {
  // we need to give these commands lots of time to run
  this.timeout(10000);

  var testFilename = path.join(__dirname, 'urls.txt'),
      testURLs = splitLines(fs.readFileSync(testFilename).toString());

  it('complains when it gets too few args', function(done) {
    var proc = run([]);
    assertExitCode(proc, 1, done);
  });

  it('takes a single URL', function(done) {
    var proc = run(['google.com']);
    assertIO(proc, function(output) {
      assert.ok(output, 'no output!');
      assert.ok(output.indexOf('google.com') > -1, 'google.com not in the output: ' + output);
      done();
    });
  });

  it('takes multiple URLs', function(done) {
    var proc = run(['google.com', 'yahoo.com']);
    assertIO(proc, function(stdout) {
      assert.ok(stdout, 'no output!');
      assert.ok(stdout.indexOf('google.com') > -1, 'google.com not in stdout: ' + stdout);
      assert.ok(stdout.indexOf('yahoo.com') > -1, 'yahoo.com not in stdout: ' + stdout);
      var lines = splitLines(stdout);
      assert.equal(lines.length, 2, 'expected 2 lines of output, got ' + lines.length);
      done();
    });
  });

  it('reads URLs from a file', function(done) {
    var proc = run(['--file', testFilename]);
    assertIO(proc, function(stdout) {
      assert.ok(stdout, 'no output!');
      testURLs.forEach(function(url) {
        assert.ok(stdout.indexOf(url) > -1, url + 'not present in stdout: ' + stdout);
      });
      done();
    });
  });

  it('reads URLs from stdin', function(done) {
    var proc = run(['--file', '-']);
    assertIO(proc, 'google.com\nyahoo.com', function(stdout) {
      assert.ok(stdout, 'no output!');
      assert.ok(stdout.indexOf('google.com') > -1, 'google.com not in stdout: ' + stdout);
      assert.ok(stdout.indexOf('yahoo.com') > -1, 'yahoo.com not in stdout: ' + stdout);
      done();
    });
  });

  it('sorts sizes ascending', function(done) {
    var proc = run(['--file', testFilename]);
    assertIO(proc, function(stdout) {
      var lines = splitLines(stdout),
          sizes = lines.map(function(line) {
            var size = line.split('\t').shift();
            return +size.match(/^(\d+)/)[0];
          }),
          sorted = sizes.slice().sort(ascending);
      assert.deepEqual(sizes, sorted, 'bad sort order: ' + sizes + ', expected ' + sorted);
      done();
    });
  });

  it('sorts sizes descending', function(done) {
    var proc = run(['-d', '--file', testFilename]);
    assertIO(proc, function(stdout) {
      var lines = splitLines(stdout),
          sizes = lines.map(function(line) {
            var size = line.split('\t').shift();
            return +size.match(/^(\d+)/)[0];
          }),
          sorted = sizes.slice().sort(descending);
      assert.deepEqual(sizes, sorted, 'bad sort order: ' + sizes + ', expected ' + sorted);
      done();
    });
  });

  it('formats csv', function(done) {
    var proc = run(['--csv', 'google.com']);
    assertIO(proc, function(stdout) {
      parseCSV(stdout, ',', function(error, rows) {
        assert.ok(!error, 'csv parse error: ' + error);
        assert.equal(rows.length, 1, 'expected 1 row, got ' + rows.length);
        assert.equal(rows[0].url, 'http://google.com', 'bad row 0: ' + JSON.stringify(rows[0]));
        done();
      });
    });
  });

  it('formats tsv', function(done) {
    var proc = run(['--tsv', 'google.com']);
    assertIO(proc, function(stdout) {
      parseCSV(stdout, '\t', function(error, rows) {
        assert.ok(!error, 'tsv parse error: ' + error);
        assert.equal(rows.length, 1, 'expected 1 row, got ' + rows.length);
        assert.equal(rows[0].url, 'http://google.com', 'bad row 0: ' + JSON.stringify(rows[0]));
        done();
      });
    });
  });

});

function run(args) {
  return child.spawn(cmd, args, {
    stdio: 'pipe'
  });
}

function assertExitCode(process, code, done) {
  process.on('close', function(c, signal) {
    assert.equal(code, c, 'exit code mismatch: expected ' + code + ', got ' + c);
    done();
  });
}

function assertIO(process, stdin, check) {
  if (arguments.length < 3) {
    check = stdin;
    stdin = null;
  }

  var stdout = [];
  process.stdout
    .on('data', function(chunk) {
      stdout.push(chunk);
    });

  process.on('exit', done);

  if (stdin) {
    // console.log('writing:', stdin);
    process.stdin.write(stdin);
    process.stdin.end();
  }

  function done() {
    stdout = stdout.join('');
    if (typeof check === 'function') {
      check(stdout);
    } else {
      assert.equal(stdout, check, 'i/o mismatch: ' + stdout);
    }
  }
}

function splitLines(str) {
  return str.trim().split('\n').filter(function(line) {
    return line;
  });
}

function parseCSV(str, delimiter, done) {
  // XXX csv.fromString() wasn't working for me,
  // but this won't parse quotes
  var lines = splitLines(str),
      cols = lines.shift().split(delimiter),
      rows = lines.map(function(line) {
        var row = {};
        line.split(delimiter).forEach(function(d, i) {
          row[cols[i]] = d;
        });
        return row;
      });
  done(null, rows);
}

function ascending(a, b) {
  return a - b;
}

function descending(a, b) {
  return b - a;
}
