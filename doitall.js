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
    { filename: "Indigo Book 2d ed Final Front Matter.html", pagetype: "frontmatter" },
    { filename: "Indigo Book 2d ed Final Introduction.html", pagetype: "contents" },
    { filename: "Section A Final Indigo Book 2d ed.html", pagetype: "contents" },
    { filename: "Section B Final Indigo Book 2d ed.html", pagetype: "contents" },
    { filename: "Section C Final Indigo Book 2d ed.html", pagetype: "contents" },
    { filename: "Sections D-F Final Indigo Book 2d ed.html", pagetype: "contents" },
    { filename: "Indigo Book Final Tables.html", pagetype: "contents" }
]

const htmlSourcePath = (fn) => {
    var stub = path.join(".", "doc-src", "html");
    if (fn) {
        return path.join(stub, fn);
    } else {
        return stub;
    }
}

var firstdoc = null;
var firstbody = null;
var body = null;
var walker;
var currentPageType = null;
for (var fileInfo of filenames) {
    walker = new Walker(htmlSourcePath(fileInfo.filename));
    if (!firstdoc) {
        firstdoc = walker.run(true);
        firstbody = xpath.select("//body", firstdoc)[0];
        body = xpath.select("//body", firstdoc)[0].cloneNode(true);
        while (firstbody.childNodes.length > 0) {
            firstbody.removeChild(firstbody.childNodes[0]);
        }
    } else {
        var doc = walker.run(true);
        body = xpath.select("//body", doc)[0];
    }

    if (currentPageType !== fileInfo.pagetype) {
        currentPageType = fileInfo.pagetype;
        var currentTarget = firstdoc.createElement("div");
        currentTarget.setAttribute("id", currentPageType);
        currentTarget.setAttribute("page", currentPageType);
        firstbody.appendChild(currentTarget);
    }
    for(var i=0; i<body.childNodes.length; i++) {
        var child = body.childNodes[i].cloneNode(true);
		currentTarget.appendChild(child);
	}
}

console.log("Generating table of contents");

walker.setTOC(firstdoc);

var output = pretty((new serializer()).serializeToString(firstdoc));
output = walker.fixEntities(output);
output = `<!DOCTYPE html>
${output}`;
fs.writeFileSync(`${buildPath("index.html")}`, output);
console.log("  Generated file is at ./docs/index.html");
