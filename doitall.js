var path = require("path");
var Walker = require("./ib-convert");

var filenames = [
    "Indigo Book 2d ed Final Front Matter.html",
    "Section A Final Indigo Book 2d ed.html",
    "Section B Final Indigo Book 2d ed.html",
    "Section C Final Indigo Book 2d ed.html",
    "Sections D-F Final Indigo Book 2d ed.html",
    "Indigo Book Final Tables.docx"
]

const htmlSourcePath = (fn) => {
    var stub = path.join(".", "doc-src", "html");
    if (fn) {
        return path.join(stub, fn);
    } else {
        return stub;
    }
}

for (var fn of filenames) {
    var walker = new Walker(htmlSourcePath(fn));
    walker.run();
}
