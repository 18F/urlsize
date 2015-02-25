var cmd = './index.js',
    fs = require('fs'),
    path = require('path'),
    assert = require('assert'),
    child = require('child_process'),
    csv = require('fast-csv');

describe('cli', function() {
  // we need to give these commands lots of time to run
  this.timeout(10000);

  var testFilename = path.join(__dirname, 'urls.txt'),
      testURLs = splitLines(fs.readFileSync(testFilename).toString());

  it('complains when it gets too few args', function(done) {
    var proc = run([]);
    assertExitCode(proc, 1, done);
  });

  it('exits 0 when it gets enough args', function(done) {
    var proc = run(['-']);
    assertExitCode(proc, 0, done);
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
        assert.deepEqual(Object.keys(rows[0]), ['url', 'size', 'length']);
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
        assert.deepEqual(Object.keys(rows[0]), ['url', 'size', 'length']);
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
