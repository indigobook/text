const fs = require("fs");
var path = require("path");
const serializer = require("htmldom2").XMLSerializer;
const xpath = require("xpath");
const pretty = require('pretty');
var Walker = require("./ib-convert");

const buildPath = (fn) => {
    var stub = path.join(".", "docs");
    fs.mkdirSync(stub, {recursive: true});
    if (fn) {
        return path.join(stub, fn);
    } else {
        return stub;
    }
}

var filenames = [
    "Indigo Book 2d ed Final Front Matter.html",
    "Section A Final Indigo Book 2d ed.html",
    "Section B Final Indigo Book 2d ed.html",
    "Section C Final Indigo Book 2d ed.html",
    "Sections D-F Final Indigo Book 2d ed.html",
    "Indigo Book Final Tables.html"
]

const htmlSourcePath = (fn) => {
    var stub = path.join(".", "doc-src", "html");
    if (fn) {
        return path.join(stub, fn);
    } else {
        return stub;
    }
}

var outputDOM = null;
for (var fn of filenames) {
    var walker = new Walker(htmlSourcePath(fn));
    if (!outputDOM) {
        outputDOM = walker.run(true);
        var outputBody = xpath.select("//body", outputDOM)[0];
    } else {
        var doc = walker.run(true);
        var body = xpath.select("//body", doc)[0];
        for(var i=0; i<body.childNodes.length; i++) {
            var child = body.childNodes[i].cloneNode(true);
		    outputBody.appendChild(child);
	    }
    }
}
var output = pretty((new serializer()).serializeToString(outputDOM));
output = walker.fixEntities(output);
output = `<!DOCTYPE html>
${output}`;
fs.writeFileSync(`${buildPath("index.html")}`, output);
console.log("  Generated file is at ./docs/index.html");
