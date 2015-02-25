#!/usr/bin/env node

var urlsize = require('./');

var yargs = require('yargs')
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

options.urls = urls;
options.sort = sort;
options.fopts = fopts;

urlsize(options, function(err, sizes) {
  if (err) {
    console.error(err);
    return process.exit(1);
  }
  if (options.csv || options.tsv) {
    var out = options.out
          ? fs.createWriteStream(out)
          : process.stdout;
    return sizes.pipe(out);
  }
  sizes.forEach(function(size) {
    console.log(size);
  })
});
