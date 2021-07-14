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
	        } else if (cls === "MsoListParagraphCxSpFirst") {

		        // Oh! This is hard. We need to set ol, but
		        // then set the first li as the pushNode.
		        // How to do that? Return an array? No, that's
		        // going to fuzz up the logic.

		        // Catch this first node in the main function,
		        // set it, and set it as parent there. Then things
		        // unfold as noremal UNTIL we reach
		        // then end. Then what? Tough. Later.
		        
		        ret = newdoc.createElement("ol");
		        var li = newdoc.createElement("li");
		        ret.appendChild(li);
	        } else if (cls === "MsoListParagraphCxSpFirst") {
		        
	        } 
	    } else if (m[1] === "span") {
	        var style = node.getAttribute("style");
	        if (style) {
                if (style.match("small-caps")) {
        	        ret = newdoc.createElement("span");
		            ret.setAttribute("class", "small-caps");
	            }
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
	    var style = node.getAttribute("style");
	    if (style && style.match(/mso-list:Ignore/)) return;
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
    } else if (type === "comment") {
        var content = node.nodeValue;
        if (content.slice(0, 19) === "[if supportFields]>" && content.slice(-9) === "<![endif]") {
            // console.log(`Raw: ${content}`);
            content = content.slice(19, -9);
            var fieldDoc = new dom().parseFromString(content, "text/html");
            var fieldBody = xpath.select("//body", fieldDoc)[0];
            var begin = xpath.select('//span[contains(@style, "mso-element:field-begin")]', fieldBody);
            if (begin.length) {
                var fieldJSON = fieldBody.firstChild.textContent.slice(32).replace(/&quot;/g, '"').replace(/(\r\n|\n|\r)/gm, " ").replace(/formattedCitation.*plainCitation/g, "plainCitation").trim();
                var fieldObj = JSON.parse(fieldJSON);
                console.log(`HOORAY, HERE IS THE JSON DATA FOR ONE CITATION:`);
                console.log(`${JSON.stringify(fieldObj, null, 2)}`);
            }
        }
    }
}

checkEachNode(newbody, body,0);

console.log("");
console.log("HOORAY AGAIN, HERE IS SOME HTML");
console.log(pretty((new serializer()).serializeToString(newdoc)))
