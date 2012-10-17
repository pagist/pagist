
document.write('<script src="lib/marked.js"><\/script>')

Pagist.filetypes['.md'] = function markdown(text) {
  var math = new Pagist.MathExtractor()
  text = math.extract(text)
  return math.insert(marked(text))
}

