
Pagist.MathExtractor = function() {
  var map = {}
    , nextID = 1
  function id(text) {
    for (;;) {
      var id = '$Math-' + nextID++ + '$'
      if (text.indexOf(id) == -1) return id
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

Pagist.DEFAULT_LAYOUT = function(html) {
  return '<link href="//netdna.bootstrapcdn.com/twitter-bootstrap/2.1.1/css/bootstrap-combined.min.css" rel="stylesheet">'
    + '<link href="css.css" rel="stylesheet">'
    + '<script src="http://code.jquery.com/jquery.min.js"><\/script>'
    + '<script src="//netdna.bootstrapcdn.com/twitter-bootstrap/2.1.1/js/bootstrap.min.js"><\/script>'
    + '<script src="http://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS-MML_HTMLorMML"><\/script>'
    + '<div class="container">'
    +   html
    + '</div>'
    + '<div class="footer">'
    +   (this.footer || '')
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

Pagist.main = function() {

  var id = location.search.match(/^\?([^\/]+\/\w*|\w+)/)
    , endpoint

  if (!id) {
    // location.href = 'https://github.com/pagist/pagist.github.com/'
    // return
    id = '4287148'
  } else {
    id = id[1]
  }

  if (id.indexOf('/') == -1) {
    endpoint = 'https://api.github.com/gists/' + id
  } else {
    endpoint = 'http://' + id
  }

  window.handleGistData = function(res) {
    document.title = res.data.description
    var list = []
      , files = res.data.files
      , html = ''
    for (var i in files) {
      if (Object.prototype.hasOwnProperty.call(files, i)) {
        if (!files[i].filename) files[i].filename = ""
        list.push(files[i])
      }
    }
    var footer =
          '<b>gist <a href="' + res.data.html_url + '">#' + res.data.id + '</a></b>'
        + ' by <a href="https://github.com/' + res.data.user.login + '">' + res.data.user.login + '</a>'
        + ' <a href="' + res.data.html_url + '#comments">&raquo; comments</a>'
      , context = { footer: footer }
    document.write(Pagist.render(list, context))
  }

  document.write(
    '<script src="' + endpoint
  + '?callback=handleGistData&nocache=' + new Date().getTime() + '"><\/script>'
  )

}
