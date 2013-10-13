
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
    request(url, function(err, res, body) {
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
  googledrive: function(params, callback) {
    var url = 'http://googledrive.com/host/' + params.path
    return makeRequest(url)
  },
  etherpadlite: function(params, callback) {
    var url = params.base + '/p/' + params.name + '/export/txt'
    return makeRequest(url)
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

  var path = req.path.replace(/^\/?/, '')
  if (path === '') path = '4287148'

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
