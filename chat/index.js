
var fs = require('fs')
var _ = require('lodash')
var express = require('express')

exports.listen = function(app) {

  var templateData = fs.readFileSync(__dirname + '/chat.html', 'utf-8')
  var chatTemplate = _.template(templateData)

  app.use(express.static(__dirname + '/static'))

  app.get('/:room', function(req, res, next) {

    if (req.host == 'chat.pagist.info') {
      var room = req.param('room')
      res.send(chatTemplate({ room: room }))
    } else {
      next()
    }

  })

  app.get('/chat/:room', function(req, res, next) {

    var room = req.param('room')
    res.send(chatTemplate({ room: room }))

  })

}

