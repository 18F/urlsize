# urlsize
**urlsize** is a [Node](http://nodejs.org/)-powered command-line
utility for getting the file sizes of one or more URLs.

You can install it with `npm install -g urlsize`.

## Usage
```
urlsize [options] [<url>...]

Options:
  --file, -f  read URLs from a text file (one per line)
  -d          sort URLs by size descending (default: ascending)
  --csv, -c   output comma-separated values
  --tsv, -t   output tab-separated values
  --help, -h  show this helpful message
  -v          print more helpful messages to stderr
```

### Examples
Just get the size of a single URL:
```sh
$ urlsize google.com
50.8K   http://google.com
```

Get the size of multiple URLs:
```sh
$ urlsize google.com yahoo.com
50.8K   http://google.com
286.1K  http://yahoo.com
```

Read the list of URLs from a text file:
```sh
$ echo "usa.gov\ncensus.gov" > urls.txt
$ urlsize --file urls.txt
36.3K   http://usa.gov  
182.7K  http://census.gov
```

Output the sizes as tab-separated values, where the `length` column is the size in bytes:
```sh
$ urlsize --tsv census.gov usa.gov
url     size    length
http://usa.gov  36.3K   37126
http://census.gov       182.7K  187063
```

By default, URLs are sorted in the output by size ascending. You can sort them in descending
order with the `-d` flag:
```sh
$ urlsize -d census.gov usa.gov
182.7K  http://census.gov
36.3K   http://usa.gov  
```

### Public domain

This project is in the worldwide [public domain](LICENSE.md). As stated in
[CONTRIBUTING](CONTRIBUTING.md):

> This project is in the public domain within the United States, and copyright
> and related rights in the work worldwide are waived through the [CC0 1.0
> Universal public domain
> dedication](https://creativecommons.org/publicdomain/zero/1.0/).
>
> All contributions to this project will be released under the CC0 dedication.
> By submitting a pull request, you are agreeing to comply with this waiver of
> copyright interest.
