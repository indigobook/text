const fs = require("fs");
var path = require("path");
const dom = require("htmldom2").DOMParser;
const serializer = require("htmldom2").XMLSerializer;
const xpath = require("xpath");
const pretty = require('pretty');
var Walker = require("./ib-convert");

const basename = 'indigobook-2.0-rev2023-1';

const buildPath = (fn) => {
    var stub = path.join(".", "docs", "versions");
    fs.mkdirSync(stub, {recursive: true});
    if (fn) {
        return path.join(stub, fn);
    } else {
        return stub;
    }
}

const basepath = buildPath(`${basename}`)

const runPrince = () => {
    require('child_process')
        .execSync(`~/prince/bin/prince ${basepath}.html -o ${basepath}.pdf`);
}
    
var filenames = [
    { filename: "Indigo Book 2d ed Final Front Matter.html", pagetype: "frontmatter" },
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
        // currentTarget.setAttribute("class", "page-break");
        firstbody.appendChild(currentTarget);
    }
    for(var i=0; i<body.childNodes.length; i++) {
        var child = body.childNodes[i].cloneNode(true);
		currentTarget.appendChild(child);
    }
}

console.log("Generating table of contents");

walker.setTOC(firstdoc);
walker.setDate(firstdoc);
walker.setHash(firstdoc);

var cover = fs.readFileSync(path.join(htmlSourcePath(), "..", "Cover-1.html")).toString();

var output = pretty((new serializer()).serializeToString(firstdoc));
output = walker.fixEntities(output);
output = `<!DOCTYPE html>
${output}`;
var outputlst = output.split("<body>");
output = [outputlst[0], "<body>", cover, outputlst[1]].join("\n");


<<<<<<< HEAD
fs.writeFileSync(`${basepath}.html`, output);
console.log(`  Generated file is at ./docs/${basename}.html`);
runPrince();
console.log(`  Generated file is at ./docs/${basename}.pdf`);
=======

fs.writeFileSync(`${buildPath(`indigobook-3.0-beta.html`)}`, output);
runPrince();
console.log("  Generated file is at ./docs/indigobook-3.0-beta.html");
>>>>>>> parent of 0625c38... Initial checkin for 2.0-rev2023-1
