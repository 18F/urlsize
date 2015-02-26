'use strict';
var filesize = require('filesize'),
    request = require('request'),
    async = require('async'),
    stream = require('stream'),
    through2 = require('through2'),
    es = require('event-stream');

var urlsize = function urlsize(url, options, done) {
  // do a batch operation we got an array
  if (Array.isArray(url)) {
    return urlsize.batch(url, options, done);
  }

  if (arguments.length < 3) {
    done = options;
    options = {};
  } else if (!options) {
    options = {};
  }

  var log = options.log || (options.verbose
    ? console.warn.bind(console)
    : noop);

  if (!url.match(/^https?:\/\//)) {
    url = 'http://' + url;
  }

  log('getting %s ...', url);
  var length = 0,
      status,
      stream;
  stream = request(url)
    .on('error', done)
    .on('response', function onResponse(res) {
      status = res.statusCode;
      if ('content-length' in res.headers) {
        log('got content-length header from %s', url);
        length = res.headers['content-length'];
        stream.end();
      } else {
        log('reading %s ...', url);
        res.on('data', function onData(chunk) {
          length += chunk.length;
        });
      }
    })
    .on('end', function() {
      var size = filesize(length, options);
      done(null, {
        url: url,
        length: length,
        size: size
      });
    });
};

urlsize.batch = function(urls, options, done) {
  if (arguments.length < 3) {
    done = options;
    options = {};
  }

  var getSize = function urlsizeOptions(url, next) {
    return urlsize(url, options, next);
  };

  var finished = function(error, urls) {
    if (error) return done(error);
    if (options.sort) {
      urls.sort(urlsize.sorter(options.sort));
    }
    return done(null, urls);
  };

  if (!isNaN(options.limit)) {
    return async.mapLimit(urls, options.limit, getSize, finished);
  }
  return async.map(urls, getSize, finished);
};

urlsize.sorter = function(sort) {
  if (typeof sort === 'function') {
    return sort;
  }
  var cmp = ((typeof sort === 'string') && sort.match(/^d(esc)?/))
        ? descending
        : ascending,
      key = function(d) { return d.length; };
  return function(a, b) {
    return cmp(key(a), key(b));
  };
};

urlsize.createReadStream = function(options) {
  return through2.obj(function(buffer, enc, next) {
    var url = buffer.toString();
    return url
      ? urlsize(url, options, next)
      : next();
  });
};

urlsize.createWriteStream = function(format) {
  if (!format) format = formatURL;
  return through2.obj(function(d, enc, next) {
    return next(null, format(d) + '\n');
  });
};

module.exports = urlsize;

function noop() { }

function ascending(a, b) {
  return a - b;
}

function descending(a, b) {
  return b - a;
}

function formatURL(d) {
  return [d.size, d.url].join('\t');
}
