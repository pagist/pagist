

/*global angular, Firebase, _, MathJax*/
angular.module('chat', ['firebase', 'chatConfig', 'ngAnimate'])
.factory('refs', function(chatConfig) {
  var room = new Firebase('https://dtinth-chat.firebaseio.com/room')
               .child(chatConfig.room)
  var users = room.child('users')
  var messages = room.child('messages')
  return { users: users, messages: messages }
})
.factory('syncSession', function() {
  return function(storageKey, $scope, key) {
    try { $scope[key] = JSON.parse(window.sessionStorage[storageKey]) }
    catch (e) { }
    $scope.$watch(key, function save(value) {
      window.sessionStorage[storageKey] = JSON.stringify(value)
    }, true)
  }
})
.controller('MainController', function($scope, angularFire, refs, syncSession) {

  $scope.users    = { }
  $scope.messages = { }
  $scope.session  = { }
  $scope.stat     = { }
  
  angularFire(refs.users,    $scope, 'users')
  angularFire(refs.messages, $scope, 'messages')
  syncSession('chat',        $scope, 'session')

  $scope.me = function() { return $scope.session.user }
  $scope.self = function() { return $scope.users[$scope.me()] }
  $scope.editing = function() {
    var self = $scope.self()
    return !!self.editing
  }

  $scope.editable = function(message) {
    var self = $scope.self()
    return self.name == message.user
  }
  $scope.isUnread = function(message) {
    var self = $scope.self()
    if (self && self.read < message.time) return true
    return self.read ? false : true
  }
  $scope.isEditing = function(message) {
    return _.any($scope.users, function(user) {
      return user.editing == message.id
    })
  }

})
.controller('ChatController', function($scope, refs, $timeout, $sce, renderer) {

  $scope.text = ''

  ;(function handleKeydown() {

    $scope.keydown = function(e) {

      var self = $scope.self()

      if (e.shiftKey) return
      if (e.keyCode != 13) return
      e.preventDefault()

      if ($scope.text.trim() === '') {
        acknowledge()
      } else if (self.editing) {
        editMessage()
      } else {
        sendMessage()
      }

    }

    function acknowledge() {
      var self = $scope.self()
      self.read = $scope.stat.maxTime
    }

    function sendMessage() {
      var id = refs.messages.push().name()
      var order = _.keys($scope.messages).length
      var message = {
            user: $scope.me(),
            text: $scope.text,
            id: id,
            time: Firebase.ServerValue.TIMESTAMP
          }
      $scope.messages[id] = message
      $scope.text = ''
      $scope.stat.updateRead = id
    }

    function editMessage() {
      var self = $scope.self()
      $scope.messages[self.editing].text = $scope.text
      $scope.text = ''
      self.editing = null
    }
    
  })()

  ;(function updateTypingIndicator() {
    var timeout
    $scope.$watch('text', function(text) {
      resetTimeout()
      $scope.self().typing = text !== ''
    })
    function resetTimeout() {
      if (timeout) $timeout.cancel(timeout)
      timeout = $timeout(stopTyping, 5000)
    }
    function stopTyping() {
      $scope.self().typing = false
    }
  })()

  ;(function updateDisplay() {
    $scope.display = [ ]
    $scope.$watch('messages', function(object) {

      function getTime(message) {
        return typeof message.time == 'number' ? message.time : Infinity
      }

      var messages = _.sortBy(_.values(object), getTime)
      var display = [ ]
      messages.forEach(eachMessage)
      $scope.display = display

      var currentDisplayItem = null

      function eachMessage(message) {
        var createNewDisplayItem = false
        if (!currentDisplayItem || currentDisplayItem.user != message.user) {
          createNewDisplayItem = true
        }
        if (createNewDisplayItem) {
          display.push(currentDisplayItem = makeDisplayItem(message))
        }
        currentDisplayItem.content.push(message)
      }

      function makeDisplayItem(message) {
        return {
          id: message.id,
          user: message.user,
          content: [ ]
        }
      }

      $scope.stat.maxTime = _.max(_.filter(_.pluck(messages, 'time'), _.isNumber))
      $scope.stat.lastMessage = _.last(messages)
      
      if ($scope.stat.updateRead) {
        var message = $scope.messages[$scope.stat.updateRead]
        var self = $scope.self()
        if (message && self) {
          if (_.isNumber(message.time) && _.isNumber(self.read)) {
            self.read = Math.max(message.time, self.read)
          }
        }
      }

    }, true)
  })()

  $scope.render = function(item) {
    return renderer.render(item)
  }

  $scope.edit = function(id) {
    var self = $scope.self()
    if (self) {
      if ($scope.editable($scope.messages[id])) {
        self.editing = id
        $scope.text = $scope.messages[id].text
      }
    }
  }

  $scope.demolish = function() {
    var self = $scope.self()
    if (self) {
      delete $scope.messages[self.editing]
      self.editing = null
    }
  }

  $scope.relinquish = function() {
    var self = $scope.self()
    if (self) {
      self.editing = null
    }
  }

})
.factory('mdf', function() {

  // mdf - Inline subset of Markdown
  //
  // Adapted from showdown.js -- A javascript port of Markdown
  // Copyright (c) 2007 John Fraser.
  //
  // Original Markdown Copyright (c) 2004-2005 John Gruber
  //   <http://daringfireball.net/projects/markdown/>
  //
  // Redistributable under a BSD-style open source license.
  // See license.txt for more information.
  //
  function mdf(html) {
    html = code(html)
    html = emstrong(html)
    return html
  }

  function code(html) {
    return html.replace(
      /(^|[^\\])(`+)([^\r]*?[^`])\2(?!`)/gm,
      function(wholeMatch,m1,m2,m3,m4) {
        var c = m3;
        c = c.replace(/^([ \t]*)/g,"")  // leading whitespace
        c = c.replace(/[ \t]*$/g,"")    // trailing whitespace
        c = c.replace(/[\*_\{\}\[\]\\]/g,special)
        return m1+"<code>"+c+"</code>"
      }
    )
  }

  function emstrong(html) {
    html = html.replace(/(\*\*|__)(?=\S)([^\r]*?\S[*_]*)\1/g,
		"<strong>$2</strong>")
    html = html.replace(/(\*|_)(?=\S)([^\r]*?\S)\1/g,
            "<em>$2</em>")
    return html
  }

  function special(a) {
    return '&#' + a.charCodeAt(0) + ';'
  }

  return mdf
  
})
.factory('renderer', function(mdf) {

  var renderer = { }
  var htmlToRender = { }

  function maybe() {
    for (var i = 0; i < arguments.length; i ++) {
      if (arguments[i] != null) return arguments[i]
    }
  }

  renderer.html = function(id) {
    return maybe(htmlToRender[id], '...')
  }

  renderer.render = function(item) {

    var blocks = [ ]
    var currentBlock = null

    var PARAGRAPH = /^<p>/
    var CODE = /^<pre>/

    item.content.forEach(function(message) {

      var span = '<span message-id="' + message.id + '"></span>'
      var text = message.text

      if (PARAGRAPH.test(text)) {
        text = text.replace(PARAGRAPH, '')
        block(new Block('p'))
      } else if (CODE.test(text)) {
        text = text.replace(CODE, '')
        block(new CodeBlock())
      } else if (!currentBlock) {
        block(new Block('p'))
      }

      currentBlock.push(span)
      htmlToRender[message.id] = currentBlock.format(text)

    })

    return blocks.map(function(b) { return b.toString() }).join('')
    
    function block(blockObject) {
      blocks.push(currentBlock = blockObject)
    }

  }

  function Block(tag) {
    this._tag = tag
    this.content = [ ]
  }

  Block.prototype.start = function() {
    return '<' + this._tag + '>'
  }
  Block.prototype.end = function() {
    return '</' + this._tag + '>'
  }
  Block.prototype.push = function(html) {
    this.content.push(html)
  }
  Block.prototype.toString = function() {
    return this.start() + this.joinContent() + this.end()
  }
  Block.prototype.joinContent = function() {
    return this.content.join(' ')
  }
  Block.prototype.format = function(text) {
    var html = _.escape(text)
    html = mdf(html)
    return html
  }

  function CodeBlock() {
    Block.call(this, 'pre')
  }
  CodeBlock.prototype = Object.create(Block.prototype)
  CodeBlock.prototype.start = function() {
    return '<pre><code>'
  }
  CodeBlock.prototype.end = function() {
    return '</code></pre>'
  }
  CodeBlock.prototype.joinContent = function() {
    return this.content.join('<br>')
  }
  CodeBlock.prototype.format = function(text) {
    var html = _.escape(text)
    return html
  }
  
  return renderer
  
})
.directive('compile', function ($compile) {
  // http://stackoverflow.com/questions/17417607/angular-ng-bind-html-unsafe-and-directive-within-it
  return function(scope, element, attrs) {
    scope.$watch(
      function(scope) {
        // watch the 'compile' expression for changes
        return scope.$eval(attrs.compile)
      },
      function(value) {
        // when the 'compile' expression changes
        // assign it into the current DOM
        element.html(value)

        // compile the new DOM and link it to the current
        // scope.
        // NOTE: we only compile .childNodes so that
        // we don't get into infinite loop compiling ourselves
        $compile(element.contents())(scope)
      }
    )
  }
})
.controller('LoginController', function($scope) {
  $scope.login = function(name) {
    if (name) {
      if (!$scope.users[name]) {
        $scope.users[name] = { name: name, read: null, typing: false }
      }
      $scope.session.user = name
    }
  }
})
.factory('pool', function($compile) {
  var pool = { }
  var cache = { }
  pool.fetch = function(id, html) {
    var item = cache[id] || (cache[id] = { })
    if (item.html != html) {
      var template = '<span class="message-body"></span>'
      item.element = angular.element(template).html(html)
      item.html = html
      MathJax.Hub.Queue(["Typeset", MathJax.Hub, item.element[0]])
    }
    return item.element
  }
  return pool
})
.directive('messageId', function(renderer, pool) {

  return {
    link: function(scope, element, attrs) {
      scope.$watch(
        function(scope) {
          return renderer.html(attrs.messageId) +
            getTyping(scope.messages[attrs.messageId], scope)
        },
        function(value) {
          element.html('').append(pool.fetch(attrs.messageId, value)).append(' ')
        }
      )
      scope.$watch(
        function(scope) {
          return getClass(scope.messages[attrs.messageId], scope)
        },
        function(value) {
          element[0].className = value
        }
      )
      element.on('click', function() {
        scope.$apply(function() {
          scope.edit(attrs.messageId)
        })
      })
    }
  }

  function getTyping(message, scope) {
    var lastMessage = scope.stat.lastMessage
    if (lastMessage && message.id == lastMessage.id) {
      var user = scope.users[lastMessage.user]
      if (user && user.typing) {
        return ' ...<span class="glyphicon-pencil glyphicon typing-indicator-icon"></span>'
      }
    }
    return ''
  }

  function getClass(message, scope) {
    var classes = [ 'message' ]
    if (scope.editable(message)) {
      classes.push('mine')
    }
    if (scope.isUnread(message)) {
      classes.push('unread')
    }
    if (scope.isEditing(message)) {
      classes.push('editing')
    }
    return classes.join(' ')
  }

})




