var filesize = require('filesize'),
    request = require('request'),
    async = require('async'),
    yargs = require('yargs')
      .usage('$0 [options] <url> [<url>..]')
      .require(1)
      .alias('h', 'help'),
    options = yargs.argv,
    fopts = {
      unix: true
    },
    urls = options._;

async.map(urls, getFileSize, done);

function getFileSize(url, next) {
  var length = 0,
      status,
      stream;
  stream = request(url)
    .on('error', done)
    .on('response', function onResponse(res) {
      status = res.statusCode;
      if ('content-length' in res.headers) {
        console.warn('got content-length header from %s', url);
        length = res.headers['content-length'];
        stream.end();
      } else {
        console.warn('reading %s ...', url);
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
  if (error) return console.error('error:', error);
  urls.sort(function(a, b) {
    return a.length - b.length;
  })
  .forEach(function(d) {
    console.log([d.size, d.url].join('\t'));
  });
}
