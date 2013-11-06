
var marked = require('./pagist_marked')
var _      = require('lodash')
var fs     = require('fs')
var layout = _.template(fs.readFileSync(__dirname + '/layout.html', 'utf-8'))

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

  function preprocessTemplate(str) {
    return str.replace(/\$(\d+)/g, '<%= matches[$1] %>')
      .replace(/\$B/g, '<%= basename %>')
  }

  function template(str) {
    return _.template(preprocessTemplate(str))
  }

  function raw(options) {
    var footer   = template(options.footer)
    var url      = template(options.url)
    var filename = template(options.filename)
    var title    = template(options.title || '$B')
    return function(matches) {
      var locals = { matches: matches }
      var basename = Pagist.basename(filename(locals))
      locals.basename = basename
      return {
        type: 'raw',
        params: {
          url: url(locals)
        },
        handle: function(data) {
          return {
            title: title(locals),
            files: [
              { filename: basename, content: data }
            ],
            footer: footer(locals)
          }
        }
      }
    }
  }

  on(/^([0-9a-f]+)$/, function(m) {
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

  on(/^drive:(\w{20,})\/([^?]+)$/, raw({
    url:          'http://googledrive.com/host/$1/$2',
    filename:     '$2',
    footer:       '<a href="http://googledrive.com/host/$1/$2">$1/<b>$2</b></a> on <a href="http://googledrive.com">Google Drive</a>'
  }))

  on(/^wiki:(\w+)\/([^\/]+)\/(.+)$/, raw({
    url:      'https://raw.github.com/wiki/$1/$2/$3.md',
    filename: '$3.md',
    title:    '$3 : $1/$2 Wiki',
    footer:   '<a href="https://github.com/$1/$2/wiki/$3">$1/<b>$2</b></a> on <a href="https://github.com/$1/$2/wiki">GitHub Wiki</a>'
  }))

  on(/^(\w+)\/([^\/]+)\/(.+)$/, raw({
    url:      'https://raw.github.com/$1/$2/master/$3',
    filename: '$3',
    title:    '$B : $1/$2',
    footer:   '<a href="https://github.com/$1/$2/blob/master/$3"><b>$3</b></a> on <a href="https://github.com/$1/$2">GitHub: $1/$2</a>'
  }))

  function etherpad(providerName, baseUrl) {
    return raw({
      url:       baseUrl + '/p/$1/export/txt',
      filename:  '$1.md',
      footer:    '<a href="' + baseUrl + '/p/$1"><b>$1</b></a> on <a href="' + baseUrl + '">' + providerName + '</a>'
    })
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
  var locals = Object.create(this)
  locals.html = html
  return layout(locals)
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
