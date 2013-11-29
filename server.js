
var express = require('express')
var app = express()
var Pagist = require('./pagist')
var request = require('request')
var _ = require('lodash')
var when = require('when')
var fs = require('fs')

var template = _.template(
      '<!DOCTYPE html><meta charset=utf-8><title><%- title %></title>' +
      '<%= body %>')

function makeRequest(url) {
  return when.promise(function(resolve, reject) {
    request(url, { headers: { 'User-Agent': 'Pagist' } }, function(err, res, body) {
      if (err) reject(err)
      resolve(body)
    })
  })
}

var base = process.argv[2]

Pagist.server = {
  gist: function(params, callback) {
    var url = 'https://api.github.com/gists/' + params.id
        + '?access_token=' + process.env.GITHUB_TOKEN
    return makeRequest(url).then(JSON.parse)
  },
  raw: function(params, callback) {
    return makeRequest(params.url)
  },
  local: function(params, callback) {
    return when.promise(function(resolve, reject) {
      if (!base) throw new Error('hello!')
      fs.readFile(base + '/' + params.path, 'utf-8', function(err, data) {
        if (err) return reject(err)
        resolve(data)
      })
    })
  }
}

app.use(express.static(__dirname + '/static'))

app.use(function(req, res, next) {
  if (req.host == 'www.pagist.info' || req.host == 'pagist.info') {
    var m = req.path.match(/^\/?(\w+):/)
    if (m) {
      var rest = req.path.substr(m[0].length)
      res.redirect('http://' + m[1] + '.pagist.info/' + rest)
      return
    } else {
      next()
    }
  } else {
    next()
  }
})

function resolvePath(req) {

  var path = req.path.replace(/^\/?/, '')
  var m = req.host.match(/^(\w+)\.pagist\.info$/)

  if (m && m[1] != 'www') path = m[1] + ':' + path
  if (path === 'chat:') return '6961429'
  if (path === '') return '4287148'

  return path

}

app.use(function(req, res, next) {

  var path = resolvePath(req)

  var target = Pagist.route(path)
  if (!target) return next()

  Pagist.server[target.type](target.params)
    .then(target.handle)
    .then(function(data) {
      res.send(template({
        title: data.title,
        body: Pagist.generate(data)
      }))
    })
    .otherwise(function(e) {
      next(e)
    })

})

require('./chat').listen(app)

app.listen(process.env.PORT)
