
var marked = require('marked')

void function() {
  var old = marked.Parser.prototype.tok
  if (!old.pagist) {
    marked.Parser.prototype.tok = function() {
      if (this.token.type == 'table') {
        var result = old.apply(this, arguments)
        return '<table class="table table-bordered">' + result.substr(7)
      } else {
        return old.apply(this, arguments)
      }
    }
    marked.Parser.prototype.tok.pagist = true
  }
}()

module.exports = marked

