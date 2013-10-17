
var marked = require('marked')
var _      = require('lodash')

var Pagist = {
  filetypes: {}
}

Pagist.MathExtractor = function() {
  var map = {}
    , nextID = 1
  function id(text) {
    for (;;) {
      var cid = '$Math-' + nextID++ + '$'
      if (text.indexOf(id) == -1) return cid
    }
  }
  return {
    extract: function(text) {
      return text.replace(/\\\([\s\S]+?\\\)|\$\$[\s\S]+?\$\$/g, function(a) {
        var r = id(text)
        map[r] = a
        return r
      })
    }
  , insert: function(text) {
      for (var i in map) {
        if (Object.prototype.hasOwnProperty.call(map, i)) {
          text = text.split(i).join(map[i])
        }
      }
      return text
    }
  }
}

Pagist.render = function(files, context) {
  var html = ''
    , list = files.slice()
  list.sort(function(a, b) {
    return a.filename < b.filename ? -1 : a.filename > b.filename ? 1 : 0
  })
  for (var i = 0; i < list.length; i ++) {
    var file = list[i]
      , suffix = file.filename.match(/\.\w+/)
    if (suffix && Pagist.filetypes[suffix[0]]) {
      html += Pagist.filetypes[suffix[0]].call(file, file.content)
    } else {
      html += '<p>Unknown file: ' + file.filename + '</p>'
    }
  }
  return (Pagist.layout || Pagist.DEFAULT_LAYOUT).call(context, html)
}

Pagist.basename = function(path) {
  return path.replace(/^.*\//, '')
}

Pagist.beforeBasename = function(path) {
  return path.substr(0, path.length - Pagist.basename(path).length)
}

Pagist.route = function(path) {

  var result = null

  function on(regexp, f) {
    if (result) return
    var m = path.match(regexp)
    if (m) result = f(m)
  }

  on(/^(\d+)$/, function(m) {
    var footer = _.template(
          '<b>gist <a href="<%= html_url %>">#<%= id %></a></b>'
        + ' by <a href="https://github.com/<%= user.login %>"><%= user.login %></a>'
        + ' <a href="<%= html_url %>#comments">&raquo; comments</a>'
        )
    return {
      type:   'gist',
      params: {
        id:   m[1],
      },
      handle: function(data) {
        return {
          title:    data.description,
          files:    data.files,
          footer:   footer(data)
        }
      }
    }
  })

  on(/^drive:(\w{20,})\/([^?]+)$/, function(m) {
    var footer = _.template(
          '<a href="<%- url %>"><%- left %><b><%- right %></b></a> on <a href="http://googledrive.com">Google Drive</a>'
        )
    return {
      type:   'googledrive',
      params: {
        path: m[1] + '/' + m[2]
      },
      handle: function(data) {
        var basename = Pagist.basename(m[2])
        return {
          title:    basename,
          files:    [
            { filename: basename, content: data }
          ],
          footer:   footer({
            url: 'http://googledrive.com/host/' + m[1] + '/' + m[2],
            path: m[1] + '/' + m[2],
            left: Pagist.beforeBasename(m[1] + '/' + m[2]),
            right: basename
          })
        }
      }
    }
  })

  function etherpad(providerName, baseUrl) {
    return function(m) {
      var name = m[1]
      var footer = _.template(
            '<a href="<%- url %>"><b><%- name %></b></a> on <a href="http://board.net">board.net</a>'
          )
      return {
        type:   'etherpadlite',
        params: {
          base: baseUrl,
          name: m[1]
        },
        handle: function(data) {
          return {
            title:    name,
            files:    [
              { filename: 'content.md', content: data }
            ],
            footer:   footer({
              name: name,
              url:  baseUrl + '/p/' + name
            })
          }
        }
      }
    }
  }

  on(/^board:(\w+)$/, etherpad('board.net', 'http://board.net'))
  
  on(/^local:\/(.*)$/, function(m) {
    var path = decodeURIComponent(m[1])
    return {
      type:   'local',
      params: {
        path: path
      },
      handle: function(data) {
        return  {
          title:  path,
          files:  [
            { filename: 'content.md', content: data }
          ],
          footer: 'Local file ' + path
        }
      }
    }
  })

  return result

}

Pagist.generate = function(data) {
  var list = []
    , files = data.files
    , html = ''
  for (var i in files) {
    if (Object.prototype.hasOwnProperty.call(files, i)) {
      if (!files[i].filename) files[i].filename = ""
      list.push(files[i])
    }
  }
  var context = { footer: data.footer }
  return Pagist.render(list, context)
}

Pagist.DEFAULT_LAYOUT = function(html) {
  return '<link href="/css.css" rel="stylesheet">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
    + '<script src="http://code.jquery.com/jquery.min.js"><\/script>'
    + '<script src="//netdna.bootstrapcdn.com/twitter-bootstrap/2.1.1/js/bootstrap.min.js"><\/script>'
    + '<script src="http://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS-MML_HTMLorMML"><\/script>'
    + '<div class="container">'
    +   html
    + '</div>'
    + '<div class="footer">'
    +   (this.footer || '')
    +   '<div>Powered by <a href="http://www.pagist.info/"><b>Pagist</b></a></div>'
    + '</div>'
}

Pagist.filetypes['.html'] = function(text) {
  return text
}

Pagist.filetypes['.css'] = function(text) {
  return '<style>' + text + '</style>'
}

Pagist.filetypes['.js'] = function(text) {
  return '<script>' + text + '</script>'
}

Pagist.filetypes['.md'] = Pagist.filetypes['.txt'] = function markdown(text) {
  var math = new Pagist.MathExtractor()
  text = math.extract(text)
  return math.insert(marked(text))
}

module.exports = Pagist
