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
      .describe('stream', 'stream in urls one line at a time (incompatible with the --file, -d options)')
        .alias('stream', 's')
      .describe('help', 'show this helpful message')
      .describe('v', 'print more helpful messages to stderr')
      .alias('help', 'h')
      .wrap(72),
    options = yargs.argv,
    fopts = {
      unix: true
    },
    urls = options._,
    sort = options.d
      ? function(a, b) { return b - a; }
      : function(a, b) { return a - b; },
    help = options.help;

if (!options.stream && !options.file && !urls.length) {
  help = true;
}

if (help) {
  yargs.showHelp();
  return process.exit(1);
}

if (options.stream) {

  var src = (options.stream === true)
        ? '/dev/stdin'
        : options.stream,
      es = require('event-stream'),
      out = process.stdin
        // split on newlines
        .pipe(es.split())
        // filter out empty lines
        .pipe(es.map(function(line, next) {
          line.length ? next(null, line) : next();
        }))
        .pipe(es.map(getFileSize));

  if (options.csv) {
    var stream = createCSVStream()
      .pipe(process.stdout);
    out.on('data', stream.write);
  } else {
    out.on('data', printURL);
  }

} else if (options.file) {
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
    var dsv = createCSVStream();
    dsv.pipe(process.stdout);
    urls.forEach(function(d) {
      dsv.write(d);
    });
  } else {
    urls.forEach(printURL);
  }
}

function createCSVStream() {
  var opts = {
    delimiter: options.tsv ? '\t' : ',',
    headers: ['url', 'size', 'length']
  };
  return csv.createWriteStream(opts);
}

function printURL(d) {
  console.log([d.size, d.url].join('\t') + '\t');
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
