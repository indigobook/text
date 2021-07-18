const fs = require("fs");
const path = require("path");
const dom = require("htmldom2").DOMParser;
const serializer = require("htmldom2").XMLSerializer;
const xpath = require("xpath");
const pretty = require('pretty');

/*
 * Paths
 */
const jurisMapPath = (fn) => {
    var stub = path.join("..", "JM", "jurism", "juris-maps");
    if (fn) {
        return path.join(stub, fn);
    } else {
        return stub;
    }
}

/*
  Initialize original DOM as source
*/
// Saved as Web Page from Word
var html_txt = fs.readFileSync("sample.html").toString();
var doc = new dom().parseFromString(html_txt, "text/html");


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

/*
 * Conversion factory
 */
function Walker (doc, newdoc) {
    this.body = xpath.select("//body", doc)[0];
    this.newdoc = newdoc;
    this.newbody = xpath.select("//body", newdoc)[0];
    
    // Only these node types are of interest
    this.processTypes = {
        1: "node",
        3: "text",
        8: "comment"
    }
    
    // Converted nodes are appended to the node at the end of the "stack" array.
    this.stack = [this.newbody];

    // Load jurisdiction maps, to expand extracted jurisdiction field codes
    this.jurisdictionMap = this.getJurisdictionMap("us");
}

Walker.prototype.run = function() {
    this.processInputTree(this.body, true);
    console.log(pretty((new serializer()).serializeToString(this.newdoc)))
}

Walker.prototype.padding = function(num) {
    num = num.toString();
    while (num.length < 3) {
        num = `0${num}`;
    }
    return num;
}

Walker.prototype.getTarget = function() {
    return this.stack.slice(-1)[0];
}

Walker.prototype.addTarget = function(node) {
    this.stack.push(node);
}

Walker.prototype.dropTarget = function() {
    this.stack.pop();
}

Walker.prototype.getJurisdictionMap = function(code) {
    var accByPos = {};
    var accByKey = {};
    
    var _jurisdictionKeySplit = code.split(":");
    var topJurisdiction = _jurisdictionKeySplit[0];
    console.log(`Loading jurisdiction codes for: ${topJurisdiction}`);
    
    var jurisdictionFile = `juris-${topJurisdiction}-map.json`;
    var jurisdictionJSON = fs.readFileSync(jurisMapPath(jurisdictionFile)).toString();
    var jurisdictionRawData = JSON.parse(jurisdictionJSON);

    var jurisdictionList = jurisdictionRawData.jurisdictions.default;
    accByPos[0] = {
        offset: this.padding(jurisdictionList[0][0].length),
        code: jurisdictionList[0][0],
        name: `${jurisdictionList[0][1]}|${jurisdictionList[0][0].toUpperCase()}`
    }

    for (var i=1,ilen=jurisdictionList.length; i<ilen; i++) {
        var jurisdictionInfo = jurisdictionList[i];
        var parentPos = jurisdictionInfo[2];
        var parentInfo = accByPos[parentPos];
        var code = `${parentInfo.code}:${jurisdictionInfo[0]}`;
        var name = `${parentInfo.name}|${jurisdictionInfo[1]}`;
        accByPos[i] = {
            offset: this.padding(code.length),
            code: code,
            name: name
        }
    }
    for (var pos in accByPos) {
        var info = accByPos[pos];
        accByKey[info.code] = `${info.offset}${info.code}${info.name}`;
    }
    return accByKey;
}

Walker.prototype.fixNode = function(node) {
    var ret = null;
    var tn = node.tagName;
    var m = tn.match(/(h[0-9]|p|span|table|tr|td|i|li|ul|ol|b)/);
    if (m) {
	    if (m[1] === "p") {
	        ret = this.newdoc.createElement("p");
	        var cls = node.getAttribute("class");
	        if (cls === "Inkling") {
		        ret.setAttribute("class", cls);
	        } else if (cls === "MsoListParagraphCxSpFirst") {

		        // Oh! This is hard. We need to set ol, but
		        // then set the first li as the pushNode.
		        // How to do that? Return an array? No, that's
		        // going to fuzz up the logic.

		        // Catch this first node in the main function,
		        // set it, and set it as target there. Then things
		        // unfold as noremal UNTIL we reach
		        // then end. Then what? Tough. Later.
		        
		        ret = this.newdoc.createElement("ol");
		        var li = this.newdoc.createElement("li");
		        ret.appendChild(li);
	        } else if (cls === "MsoListParagraphCxSpFirst") {
		        
	        } 
	    } else if (m[1] === "span") {
	        var cls = node.getAttribute("class");
	        var style = node.getAttribute("style");
            if (style && style.match("small-caps")) {
        	    ret = this.newdoc.createElement("span");
		        ret.setAttribute("class", "small-caps");
            } else if (cls && cls.match("juris")) {
                ret = this.newdoc.createElement(tn);
	        } else {
                ret = false;
	        }
        } else {
	        ret = this.newdoc.createElement(tn);
        }
    }
    return ret;
}

Walker.prototype.processInputTree = function(node, topOfTree) {
    var type = this.processTypes[node.nodeType];
    if (type === "text") {
	    var content = node.nodeValue.replace(/&nbsp;/g, " ").replace(/¥s+/g, " ");
	    if (content.trim()) {
	        var newnode = this.newdoc.createTextNode(content);
	        this.getTarget().appendChild(newnode);
	    }
    } else if (type === "node") {
	    var style = node.getAttribute("style");
	    if (style && style.match(/mso-list:Ignore/)) return;
        // No singletons. What about BR and HR?
	    if (node.childNodes.length > 0) {

            // There is a dirty trick here. Word HTML output contains
            // a lot of tags that are entirely of no interest to us,
            // as well as span tags with text content that we need,
            // but which themselves generally just amount to clutter.
            // fixNode() returns null for the former, but for the
            // latter it returns false. In the block below, tags that
            // evaluate null are dropped entirely, and tags that
            // evaluate false are not pushed to target, but we descend
            // into their children, if any.
	        var pushNode = this.fixNode(node);
            if (pushNode !== null) {
                if (pushNode) {
		            this.getTarget().appendChild(pushNode);
                    this.addTarget(pushNode);
                }
	            for(var i=0; i<node.childNodes.length; i++) {
                    var child = node.childNodes[i];
		            this.processInputTree(child);
	            }
                if (pushNode) {
                    this.dropTarget();
                }
            }
	    }
    }
}

const walker = new Walker(doc, newdoc);
walker.run();

/*

  NEXT STEP IS TO RESTORE AND DEBUG THIS

 else if (type === "comment") {
        return;
        var content = node.nodeValue;
        if (content.slice(0, 19) === "[if supportFields]>" && content.slice(-9) === "<![endif]") {
            // console.log(`Raw: ${content}`);
            content = content.slice(19, -9);
            var fieldDoc = new dom().parseFromString(content, "text/html");
            var fieldBody = xpath.select("//body", fieldDoc)[0];
            var begin = xpath.select('//span[contains(@style, "mso-element:field-begin")]', fieldBody);
            if (begin.length) {
                var fieldJSON = fieldBody.firstChild.textContent.slice(32).replace(/&quot;/g, '"').replace(/(\r\n|\n|\r)/gm, " ").trim();
                var fieldObj = JSON.parse(fieldJSON);
                for (var itemObj of fieldObj.citationItems) {
                    if (itemObj.itemData.jurisdiction) {
                        itemObj.itemData.jurisdiction = this.jurisdictionMap[itemObj.itemData.jurisdiction];
                    }
                }
                var wrapper = this.newdoc.createElement("span");
                wrapper.setAttribute("class", "juris");
                var pushNode = checkNode(wrapper);
                this.getTarget().appendChild(pushNode);
                this.addTarget(pushNode);
            }
        }
    }
*/

