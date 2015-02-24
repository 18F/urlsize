var filesize = require('filesize'),
    request = require('request'),
    async = require('async'),
    fs = require('fs'),
    rw = require('rw'),
    csv = require('fast-csv');
    
module.exports = function(options, cb) {
  if (options.file) {
    var src = (options.file === '-' || options.file === true)
      ? '/dev/stdin'
      : options.file;
    LOG('reading URLs from %s ...', src);
    rw.readFile(src, {}, function(error, buffer) {
      if (error) {
        var msg = 'unable to read from ' + src + ': ' + error.message
        return cb(new Error(msg))
      }
      options.urls = buffer.toString()
        .split(/[\r\n]+/)
        .filter(notEmpty);
      LOG('read %d URLs from %s', options.urls.length, src);
      main(options.urls);
    });
  } else {
    main(options.urls);
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
        var size = filesize(length, options.fopts);
        next(null, {
          url: url,
          length: length,
          size: size
        });
      });
  }

  function done(error, urls) {
    if (error) return cb(new Error('error: ' + error.message));

    // sort the URLs by length
    urls.sort(function(a, b) {
      return options.sort(a.length, b.length);
    });

    if (options.csv || options.tsv) {
      var opts = {
        delimiter: options.tsv ? '\t' : ',',
        headers: ['url', 'size', 'length']
      };
      
      var dsv = csv.createWriteStream(opts);
      urls.forEach(function(d) {
        dsv.write(d);
      });
      cb(null, dsv);
    } else {
      var results = urls.map(function(d) {
        return [d.size, d.url].join('\t') + '\t';
      });
      cb(null, results);
    }
  }

  function notEmpty(str) {
    return str && str.length;
  }

  function LOG() {
    options.v && console.log.apply(console, arguments);
  }
}