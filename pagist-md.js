
document.write('<script src="lib/marked.js"><\/script>')

Pagist.filetypes['.md'] = function markdown(text) {
  return marked(text)
}

