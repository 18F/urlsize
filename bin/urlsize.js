#!/usr/bin/env node
'use strict';
var urlsize = require('../'),
    fs = require('fs'),
    csv = require('fast-csv'),
    through2 = require('through2'),
    split2 = require('split2'),
    streamify = require('stream-array'),
    yargs = require('yargs')
      .usage('$0 [ --stream [options] | --file <file> [options] | [options] <url> [<url>...] ]')
      .describe('stream', 'stream URLs in, one per line')
      .describe('file', 'read URLs from a text file (one per line)')
        .alias('file', 'f')
      .describe('desc', 'sort URLs by size descending (default: ascending)')
        .boolean('desc')
        .alias('desc', 'd')
      .describe('csv', 'output comma-separated values')
        .boolean('csv')
        .alias('csv', 'c')
      .describe('tsv', 'output tab-separated values')
        .boolean('tsv')
        .alias('tsv', 't')
      .describe('out', 'write to this file')
        .alias('out', 'o')
      .describe('help', 'show this helpful message')
      .describe('v', 'print more helpful messages to stderr')
      .alias('help', 'h'),
    options = yargs.argv,
    help = options.help,
    urls = options._;

if (!options.stream
    && !options.file
    && !urls.length) {
  help = true;
} else if (urls[0] === '-') {
  // console.warn('reading from stdin; you should probably be using --stream');
  options.stream = true;
  urls = [];
}

if (help) {
  yargs.showHelp();
  return process.exit(1);
}

var sizeOptions = {
      unix: true,
      sort: options.desc ? 'd' : 'a'
    },
    fopts = {
      encoding: 'utf8'
    };

if (options.stream) {

  createInputStream()
    .pipe(urlsize.createReadStream(sizeOptions))
    .pipe(createFormatStream())
    .pipe(createOutputStream());

} else if (options.file) {

  createInputStream()
    .on('data', function(url) {
      if (url) urls.push(url);
    })
    .on('end', function() {
      batchURLs();
    });

} else {

  batchURLs();

}

function createInputStream() {
  var file = options.file,
      input;
  if (file && file !== '-' && file !== true) {
    input = fs.createReadStream(options.file, fopts);
  } else {
    input = process.stdin;
  }
  return input.pipe(split2());
}

function createOutputStream() {
  return options.out
    ? fs.createWriteStream(options.out, fopts)
    : process.stdout;
}

function createFormatStream() {
  if (options.csv || options.tsv) {
    return createCSVStream();
  }
  return urlsize.createWriteStream();
}

function createCSVStream() {
  return csv.format({
    delimiter: options.tsv ? '\t' : ',',
    headers: true
  });
}

function batchURLs() {
  urlsize.batch(urls, sizeOptions, function(error, urls) {
    if (error) throw error;
    streamify(urls)
      .pipe(createFormatStream())
      .pipe(createOutputStream());
  });
}
