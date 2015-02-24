#!/usr/bin/env node
var filesize = require('filesize'),
    request = require('request'),
    async = require('async'),
    fs = require('fs'),
    rw = require('rw'),
    csv = require('fast-csv'),
    yargs = require('yargs')
      .usage('$0 [options] [<url>...]')
      .describe('file', 'read URLs from a text file (one per line)')
        .alias('file', 'f')
      .describe('d', 'sort URLs by size descending (default: ascending)')
        .boolean('d')
      .describe('csv', 'output comma-separated values')
        .boolean('csv')
        .alias('csv', 'c')
      .describe('tsv', 'output tab-separated values')
        .boolean('tsv')
        .alias('tsv', 't')
      .describe('help', 'show this helpful message')
      .describe('v', 'print more helpful messages to stderr')
      .alias('help', 'h'),
    options = yargs.argv,
    fopts = {
      unix: true
    },
    urls = options._,
    sort = options.d
      ? function(a, b) { return b - a; }
      : function(a, b) { return a - b; },
    help = options.help;

if (!options.file && !urls.length) {
  help = true;
}

if (help) {
  yargs.showHelp();
  return process.exit(1);
}

if (options.file) {
  var src = (options.file === '-' || options.file === true)
    ? '/dev/stdin'
    : options.file;
  LOG('reading URLs from %s ...', src);
  rw.readFile(src, {}, function(error, buffer) {
    if (error) return ERROR('unable to read from %s: %s', src, error);
    urls = buffer.toString()
      .split(/[\r\n]+/)
      .filter(notEmpty);
    LOG('read %d URLs from %s', urls.length, src);
    main(urls);
  });
} else {
  main(urls);
}

function main(urls) {
  async.map(urls, getFileSize, done);
}

function getFileSize(url, next) {
  if (!url.match(/^https?:\/\//)) {
    url = 'http://' + url;
  }
  LOG('getting %s ...', url);
  var length = 0,
      status,
      stream;
  stream = request(url)
    .on('error', done)
    .on('response', function onResponse(res) {
      status = res.statusCode;
      if ('content-length' in res.headers) {
        LOG('got content-length header from %s', url);
        length = res.headers['content-length'];
        stream.end();
      } else {
        LOG('reading %s ...', url);
        res.on('data', function onData(chunk) {
          length += chunk.length;
        });
      }
    })
    .on('end', function() {
      var size = filesize(length, fopts);
      next(null, {
        url: url,
        length: length,
        size: size
      });
    });
}

function done(error, urls) {
  if (error) return ERROR('error:', error);

  // sort the URLs by length
  urls.sort(function(a, b) {
    return sort(a.length, b.length);
  });

  if (options.csv || options.tsv) {
    var opts = {
      delimiter: options.tsv ? '\t' : ',',
      headers: ['url', 'size', 'length']
    };
    var out = options.out
          ? fs.createWriteStream(out)
          : process.stdout,
        dsv = csv.createWriteStream(opts);
    dsv.pipe(out);
    urls.forEach(function(d) {
      dsv.write(d);
    });
  } else {
    urls.forEach(function(d) {
      console.log([d.size, d.url].join('\t') + '\t');
    });
  }
}

function notEmpty(str) {
  return str && str.length;
}

function LOG() {
  options.v && console.log.apply(console, arguments);
}

function ERROR() {
  console.error.apply(console, arguments);
}
