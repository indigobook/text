const fs = require("fs");
const dom = require("htmldom2").DOMParser;
const serializer = require("htmldom2").XMLSerializer;
const xpath = require("xpath");
const pretty = require('pretty');

/*
  Only these node types are of interest
*/
const processTypes = {
    1: "node",
    3: "text",
    8: "comment"
}

/*
  Initialize original DOM as source
*/
var html_txt = fs.readFileSync("sample-saved-as-web-page.html").toString();
var doc = new dom().parseFromString(html_txt, "text/html");
var body = xpath.select("//body", doc)[0];

/*
  Initialize new DOM as output target.
*/
var template = `
<html>
  <head>
    <title>Indigo Book</title>
  </head>
  <body/>
</html>
`.trim();
var newdoc = new dom().parseFromString(template, "text/html");
var newbody = xpath.select("//body", newdoc)[0];

/*
  Nodes are appended to the node at the end of the "stack" array.
*/
var stack = [newbody];

/*
  Set the output node, or return null to ignore
*/
const checkNode = (node) => {
    var ret = null;
    var tn = node.tagName;
    var m = tn.match(/(h[0-9]|p|span|table|tr|td|i|li|ul|ol|b)/);
    if (m) {
	if (m[1] === "p") {
	    ret = newdoc.createElement("p");
	    var cls = node.getAttribute("class");
	    if (cls === "Inkling") {
		ret.setAttribute("class", cls);
	    }
	} else if (m[1] === "span") {
	    var style = node.getAttribute("style");
	    if (style && style.match("small-caps")) {
		ret = newdoc.createElement("span");
		ret.setAttribute("class", "small-caps");
	    }
	} else {
	    ret = newdoc.createElement(tn);
	}
    }
    return ret;
}

/*
  Recursive scraper function
*/
const checkEachNode = (parent, node, depth) => {
    var type = processTypes[node.nodeType];
    if (type === "text") {
	var content = node.nodeValue.replace(/&nbsp;/g, " ").replace(/¥s+/g, " ");
	if (content.trim()) {
	    var newnode = newdoc.createTextNode(content);
	    parent.appendChild(newnode);
	}
    } else if (type === "node") {
	if (node.childNodes.length > 0) {
	    var pushNode = checkNode(node);
	    var newparent;
	    if (pushNode) {
		if (depth > 0) {
		    parent.appendChild(pushNode);
		    newparent = pushNode;
		} else {
		    newparent = parent;
		}
	    } else {
		newparent = parent;
	    }
	    for(var i=0; i<node.childNodes.length; i++) {
		//console.log(`PUSHED parent ${newnode.tagName} depth is ${depth}, stack length is: ${stack.length}`);
		checkEachNode(newparent, node.childNodes[i], depth+1);
	    }
	}
    }
}

checkEachNode(newbody, body,0);

console.log(pretty((new serializer()).serializeToString(newdoc)))
