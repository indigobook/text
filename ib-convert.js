const fs = require("fs");
const os = require("os");
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

const buildPath = (fn) => {
    var stub = path.join(".", "docs");
    fs.mkdirSync(stub, {recursive: true});
    if (fn) {
        return path.join(stub, fn);
    } else {
        return stub;
    }
}

const itemDataPath = (fn) => {
    var stub = path.join(buildPath(), "static", "itemdata");
    fs.mkdirSync(stub, {recursive: true});
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
const domifyInput = (filePath) => {
    var res = {};
    if (fs.existsSync(filePath)) {
        var html_txt = fs.readFileSync(filePath).toString();
        // The volume of these empty namespaced para tags in the source
        // can apparently cause a stack overflow in the parser.
        html_txt = html_txt.split("<o:p></o:p>").join("");
        res.doc = new dom().parseFromString(html_txt, "text/html");
        res.filename = path.basename(filePath);
    } else {
        var err = new Error(`The file "${filePath}" does not exist.`);
        console.log(`  Error: ${err.message}`);
        process.exit();
    }
    return res;
}

/*
  Initialize new DOM as output target.
*/
var template = `
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Sample Output: Indigo Book</title>
    <style>
      .inkling-box {
          border: 1px solid black;
          padding-left: 1em;
          padding-right: 1em;
      }
      .inkling-title {
          font-variant: small-caps;
      }
      .cite:hover {
          background: #eeeeee;
      }
      table thead tr {
        font-weight: bold;
        background: #eeeeee;
      }
      table tr td {
        vertical-align: top;
      }
      table, table th, table td, table tr {
          border: 1px solid #ccc;
          border-collapse: collapse;
      }
      td.grey-box {
          background:#D0CECE;
      }
    </style>
  </head>
  <body></body>
</html>
`.trim();
var newdoc = new dom().parseFromString(template, "text/html");

/*
 * Conversion factory
 */
function Walker (doc, newdoc) {
    this.citePos = 1;
    this.doc = doc;
    this.body = xpath.select("//body", doc)[0];
    this.newdoc = newdoc;
    this.newbody = xpath.select("//body", newdoc)[0];
    this.listType = "ul";
    this.didTab = false;
    this.insideInkling = false;
    this.listLevel = null;
    this.listID = null;
    
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

    var signalMap = {
        none: "",
        eg: "e.g.",
        accord: "accord",
        see: "see",
        seealso: "see also",
        seeeg: "see, e.g.",
        cf: "cf.",
        contra: "contra",
        butsee: "but see",
        seegenerally: "see generally",
        Eg: "E.g.",
        Accord: "Accord",
        See: "See",
        Seealso: "See also",
        Seeeg: "See, e.g.",
        Cf: "Cf.",
        Contra: "Contra",
        Butsee: "But see",
        Butseeeg: "But see, e.g.",
        Seegenerally: "See generally",
        butcf: "but cf.",
        compare: "compare",
        Butcf: "But cf.",
        Compare: "Compare",
        with: "with",
        and: "and",
        affirmed: "aff'd",
        affirming: "aff'g",
        certdenied: "cert. denied",
        other: "on other grounds",
        revsub: "sub nom.",
        affirmed: "aff'd",
        affirming: "aff'g",
        certdenied: "cert. denied",
        reversed: "rev'd",
        other: "on other grounds",
        subnom: "sub nom.",
        description: "Description of content,",
        semicolon: "; "
    }
    delete signalMap["none"];

    this.signalMap = signalMap;

    this.reverseSignalMap = function() {
        var ret = {};
        for (var key in signalMap) {
            var val = signalMap[key].replace(/[\s,]*$/, "");
            ret[val] = key;
        }
        return ret;
    }();

    this.reverseSignalRex = new RegExp(`(${Object.keys(this.reverseSignalMap).join("|")})`);
}

Walker.prototype.getNodeType = function(node) {
    return this.processTypes[node.nodeType];
}

Walker.prototype.run = function(fileStub) {
    // Purge p nodes that produce no meaningful output.
    // This is necessary to avoid confusion in read-ahead
    // handling of Inklings
    this.fileName = fileStub;
    console.log(`Processing for: ${this.fileName}`);
    var elems = this.doc.getElementsByTagName("p");
    for (var i=elems.length-1; i>-1; i--) {
        var elem = elems[i];
        var val = elem.textContent;
        val = val.replace(/(?:&nbsp;|\s)/g, "");
        if (!val) {
            elem.parentNode.removeChild(elem);
        }
    }
    
    this.processInputTree(this.body, true);
    // Okay, this isn't good enough. Because we now do look-ahead
    // on input nodes, empty ones are a problem. The trouble for a
    // quick and easy fix, though, is that the code below does a
    // final pass over OUTPUT to cull them: but we need to preemptively
    // purge them from input, before submitting to the converter.
    //
    // It looks as through purging empty p nodes alone in a preclean
    // will do the trick. The we can purge b, i and blockquote here
    // as per current state of play.
    //
    // Cleanup
    var tagList = ["p", "b", "i", "blockquote"];
    for (var tagName of tagList) {
        var elems = this.newdoc.getElementsByTagName(tagName);
        for (var i=elems.length-1; i>-1; i--) {
            var elem = elems[i];
            var content = elem.textContent.trim();
            if (!content || content === "&nbsp;") {
                elem.parentNode.removeChild(elem);
            }
        }
    }
    var output = pretty((new serializer()).serializeToString(this.newdoc));
    output = `<!DOCTYPE html>
${output}`;
    fs.writeFileSync(`${buildPath(fileStub)}`, output);
    // console.log(pretty((new serializer()).serializeToString(this.newdoc)))
}

Walker.prototype.padding = function(num) {
    num = num.toString();
    while (num.length < 3) {
        num = `0${num}`;
    }
    return num;
}

Walker.prototype.getTarget = function() {
    var ret = this.stack.slice(-1)[0];
    return ret;
}

Walker.prototype.addTarget = function(node) {
    var target = this.getTarget();
    target.appendChild(node);
    this.stack.push(node);
}

Walker.prototype.dropTarget = function() {
    var node = this.stack.pop();
    // console.log(node.textContent);
}

Walker.prototype.getJurisdictionMap = function(code) {
    var accByPos = {};
    var accByKey = {};
    
    var _jurisdictionKeySplit = code.split(":");
    var topJurisdiction = _jurisdictionKeySplit[0];
    // console.log(`Loading jurisdiction codes for: ${topJurisdiction}`);
    
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

Walker.prototype.appendOrdinaryNode = function(inputNode, outputNode) {
    // There is a dirty trick here. Word HTML output contains
    // a lot of tags that are entirely of no interest to us,
    // as well as span tags with text content that we need,
    // but which themselves generally just amount to clutter.
    // fixNode() returns null for the former, but for the
    // latter it returns false. In the block below, tags that
    // evaluate null are dropped entirely, and tags that
    // evaluate false are not pushed to target, but we descend
    // into their children, if any.
    if (outputNode !== null) {
        if (outputNode) {
            if (this.getIndent(inputNode)) {
                outputNode = this.newdoc.createElement("blockquote");
            }
            this.addTarget(outputNode);
        }
	    for(var i=0; i<inputNode.childNodes.length; i++) {
            var child = inputNode.childNodes[i];
            // console.log(`   child: ${child.textContent}`);
		    this.processInputTree(child);
	    }
        if (outputNode) {
            this.dropTarget();
        }
    }
}

Walker.prototype.getIndent = function(node) {
    var ret = 0;
    if (node.tagName === "p") {
        var style = node.getAttribute("style");
        if (style) {
            var m = style.match(/margin-left:\s*([-0-9]+)/);
            if (m) {
                var margin = parseInt(m[1], 10);
                if (margin > 0) {
                    ret = margin;
                }
            }
        }
    }
    return ret;
}

Walker.prototype.getListInfo = function(node) {
    var ret = {};
    var currentIndent = this.getIndent(node);
    var style = node.getAttribute("style");
    if (style) {
        ret = {};
        var m = style.match(/mso-list:\s*(l[0-9]+)[^;]*level([0-9])/);
        if (m) {
            ret.id = m[1];
            ret.level = parseInt(m[2], 10);
        }
    }
    var nextElementSibling = this.getNextNonEmptyElementSibling(node);
    ret.nextElementSiblingIsList = false;
    if (nextElementSibling) {
        var nextIndent = this.getIndent(nextElementSibling);
        if (nextIndent >= currentIndent) {
            ret.nextElementSiblingIsList = true;
        } else {
            var nextElementSiblingStyle = nextElementSibling.getAttribute("style");
            if (nextElementSiblingStyle) {
                ret.nextElementSiblingIsList = nextElementSiblingStyle.indexOf("mso-list") > -1;
            }
        }
    }
    return ret;
}

Walker.prototype.setListType = function(node) {
    // This is just, like, wow. Word HTML output contains nothing in
    // the attributes to indicate whether a list is a numbered list
   // or a set of bullet points. We need to extract the literal
    // values and apply a heuristic.
    var ret = "ul";
    var bulletOrNumber = xpath.select('.//span[@style="mso-list:Ignore"]', node)[0];
    if (bulletOrNumber) {
        // console.log(`  ${bulletOrNumber.firstChild.nodeValue}`)
    } else {
        console.log(`  No number in list, in file "${this.fileName}" under "${node.parentNode.textContent.trim().slice(0,20)}" near "${node.textContent.trim().slice(0,60)}"`);
    }
    if (bulletOrNumber && bulletOrNumber.firstChild && this.getNodeType(bulletOrNumber.firstChild) === "text") {
        var chr = bulletOrNumber.firstChild.nodeValue;
        if (chr.match(/^[a-zA-Z0-9]/)) {
            ret = "ol";
        }
    }
    this.listType = ret;
}

/*
 * Each list node processor is in five parts:
 * 1. Close any existing nested OL|UL/LI
 + 2. Close any existing LI
 * 3. Set the current LI
 * 4. Set any nested OL|UL/LI
 * 5. Process any text of the current input node
 */

// Okay, I've done this in the wrong way.
// Lists may be represented in several ways in the exported HTML:
// * As a proper list marked up with ul/li or ol/li (yay); or
// * As p nodes with a list class; OR
// * As ordinary p nodes with class Body.
// The ONLY common feature of these three is that they have
// a style attribute mso-list with a string value containing
// "level[1-9]" in it somewhere. So reconstructed markup needs
// to use that value as a primary, not secondary, indicator
// of BOTH list status AND list nesting level. In the code below,
// I've used the extracted level value to set nesting level, but
// not to determine if we've entered/exited a list environment
// in the first place. That needs to be fixed.

Walker.prototype.appendSoloListNode = function(inputNode, newListLevel) {
    this.setListType(inputNode);
    // 1. noop
    // 2. noop
    // 3. Open list environment and set initial LI
	var olul = this.newdoc.createElement(this.listType);
    this.addTarget(olul);
	var li = this.newdoc.createElement("li");
    this.addTarget(li);
    // 4. noop
    // 5. Text children
	for(var i=0; i<inputNode.childNodes.length; i++) {
        var child = inputNode.childNodes[i];
		this.processInputTree(child);
	}
    this.dropTarget();
    this.dropTarget();
}

Walker.prototype.appendOpeningListNode = function(inputNode, newListLevel) {
    this.setListType(inputNode);
    // 1. noop
    // 2. noop
    // 3. Open list environment and set initial LI
	var olul = this.newdoc.createElement(this.listType);
    this.addTarget(olul);
	var li = this.newdoc.createElement("li");
    this.addTarget(li);
    // 4. noop
    // 5. Text children
	for(var i=0; i<inputNode.childNodes.length; i++) {
        var child = inputNode.childNodes[i];
		this.processInputTree(child);
	}
}

Walker.prototype.appendMiddleListNode = function(inputNode, newListLevel) {
    this.setListType(inputNode);
    // 1. Close any nested list levels that we're done with
    this.raiseNestingLevel(newListLevel);
    var levelWillDeepen = this.deepenNestingLevelCheck(newListLevel);
    if (!levelWillDeepen) {
        // 2. Close existing LI
        this.dropTarget();
        // 3. Set the current LI
        var li = this.newdoc.createElement("li");
        this.addTarget(li);
    }
    // 4. Open list levels if appropriate
    this.deepenNestingLevel(newListLevel);
    // 5. Process text for this node
	for(var i=0; i<inputNode.childNodes.length; i++) {
        var child = inputNode.childNodes[i];
		this.processInputTree(child);
	}
}

Walker.prototype.appendClosingListNode = function(inputNode) {
    // Same as for mid-list nodes
    this.appendMiddleListNode(inputNode);
    // Drop LI
    this.dropTarget();
    // Drop OL|UL
    this.dropTarget();
}

Walker.prototype.raiseNestingLevel = function(newListLevel) {
    var ret = false;
    if (newListLevel < this.listLevel) {
        ret = true;
        while (newListLevel < this.listLevel) {
            // Drop LI
            this.dropTarget();
            // Drop OL|UL
            this.dropTarget();
            newListLevel++;
        }
    }
    return ret;
}

Walker.prototype.deepenNestingLevelCheck = function(newListLevel) {
    return this.deepenNestingLevel(newListLevel, true);
}

Walker.prototype.deepenNestingLevel = function(newListLevel, justLooking) {
    var ret = false;
    if (newListLevel > this.listLevel) {
        ret = true;
        if (!justLooking) {
            while (newListLevel > this.listLevel) {
	            var olul = this.newdoc.createElement(this.listType);
                this.addTarget(olul);
	            var li = this.newdoc.createElement("li");
                this.addTarget(li);
                newListLevel--;
            }
        }
    }
    return ret;
}

/*
 * Okay, shoot. To close the box, we need to know when the last
 * Inkling is added. That's easy, BUT after identifying it, we
 * need to process its children. OH! This is identical to the
 * pattern in appendOrdinaryNode. Good, okay.
 */

Walker.prototype.openInklingBoxNode = function(inputNode) {
    this.insideInkling = true;
    var inklingBox = this.newdoc.createElement("div");
    inklingBox.setAttribute("class", "inkling-box");
    this.addTarget(inklingBox);
    var inklingTitle = this.newdoc.createElement("p");
    inklingTitle.setAttribute("class", "inkling-title");
    inklingBox.appendChild(inklingTitle);
    this.addTarget(inklingTitle);
	    for(var i=0; i<inputNode.childNodes.length; i++) {
            var child = inputNode.childNodes[i];
            // console.log(`   child: ${child.textContent}`);
		    this.processInputTree(child);
	    }
    
    var nextNode = inputNode.nextSibling;
    while (this.getNodeType(nextNode) === "text") {
        nextNode = nextNode.nextSibling;
    }
    if (!nextNode.getAttribute("class") || nextNode.getAttribute("class") !== "Inkling") {
        // Close node AND box if we hit a non-inkling at the same nesting level
        this.dropTarget();
        this.dropTarget();
        this.insideInkling = false;
    }
}

Walker.prototype.appendInklingNode = function(inputNode) {
    if (!this.insideInkling) {
        var err = new Error(`  Inkling is not preceded by Inkling Title.
  Hint: ${inputNode.textContent}`);
        console.log(`  ${err.message}`);
        process.exit();
    }
    this.dropTarget();
    var inkling = this.newdoc.createElement("p");
    inkling.setAttribute("class", "inkling");
    this.addTarget(inkling);
    
	    for(var i=0; i<inputNode.childNodes.length; i++) {
            var child = inputNode.childNodes[i];
            // console.log(`   child: ${child.textContent}`);
		    this.processInputTree(child);
	    }

    var nextNode = inputNode.nextSibling;
    while (this.getNodeType(nextNode) === "text") {
        nextNode = nextNode.nextSibling;
    }
    if (!nextNode.getAttribute("class") || nextNode.getAttribute("class") !== "Inkling") {
        // Close node AND box if we hit a non-inkling at the same nesting level
        this.dropTarget();
        this.dropTarget();
        this.insideInkling = false;
    }
}

Walker.prototype.getNextElementSibling = function(node) {
    while (node !== null) {
        node = node.nextSibling;
        if (node && this.getNodeType(node) === "node") {
            break;
        }
    }
    return node;
};

Walker.prototype.getNextNonEmptyElementSibling = function(node) {
    node = this.getNextElementSibling(node);
    while (node && !node.textContent.trim()) {
        node = this.getNextElementSibling(node);
    }
    return node;
};

Walker.prototype.fixNodeAndAppend = function(node) {
    var ret = null;
    var tn = node.tagName;
    var m = tn.match(/(table|thead|tbody|span|h[0-9]|sup|p|tr|td|ul|ol|i|li|b)/);
    if (m) {
	    if (m[1] === "p") {
	        ret = this.newdoc.createElement("p");
	        var cls = node.getAttribute("class");
            var style = node.getAttribute("style");
            var listInfo = this.getListInfo(node);
	        if (cls === "InklingTitle") {
                // Encloses Inkling Title and its siblings in a nice box
                this.openInklingBoxNode(node);
	        } else if (cls === "Inkling") {
                // Sniffs ahead to close the box
                this.appendInklingNode(node);
	        } else if (cls === "MsoListParagraphCxSpFirst" && listInfo.level) {
                console.log("OPEN (a)");
                // List formatting in Word HTML output is awful
                this.appendOpeningListNode(node, listInfo.level);
                this.listLevel = listInfo.level;
	        } else if (cls === "MsoListParagraphCxSpMiddle" && listInfo.level) {
                console.log("   MIDDLE (a)");
                // List formatting in Word HTML output is awful
                this.appendMiddleListNode(node, listInfo.level);
                this.listLevel = listInfo.level;
	        } else if (cls === "MsoListParagraphCxSpLast" && listInfo.level) {
                console.log("CLOSE(a)");
                // List formatting in Word HTML output is awful
                this.appendClosingListNode(node, listInfo.level);
                this.listLevel = listInfo.level-1;
	        } else if (cls === "MsoListParagraph" && listInfo.level) {
                console.log("ONE-OFF LIST BULLET");
                // List formatting in Word HTML output is awful
                this.appendSoloListNode(node, listInfo.level);
	        } else if (cls === "Body" && !this.listLevel && listInfo.level) {
                console.log(`OPEN (b)`);
                // List formatting in Word HTML output is awful
                this.appendOpeningListNode(node, listInfo.level);
                this.listLevel = listInfo.level;
	        } else if (cls === "Body" && listInfo.nextElementSiblingIsList && listInfo.level) {
                // List formatting in Word HTML output is awful
                console.log("  MIDDLE (b)");
                this.appendMiddleListNode(node, listInfo.level);
                this.listLevel = listInfo.level;
	        } else if (cls === "Body" && !listInfo.nextElementSiblingIsList && listInfo.level) {
                // List formatting in Word HTML output is awful
                console.log("CLOSE (b)");
                this.appendClosingListNode(node, listInfo.level);
                this.listLevel = listInfo.level-1;
            } else if (this.listLevel && !this.getIndent(node)) {
                // Close any list node that might be open when we hit this?
                console.log("CLOSE (b')");
                // this.appendClosingListNode(node, listInfo.level);
                this.dropTarget();
                this.dropTarget();
                this.listLevel = 0;
            } else {
                if (node.childNodes.length > 0) {
                    this.appendOrdinaryNode(node, ret);
                }
            }
	    } else if (m[1] === "span") {
	        var cls = node.getAttribute("class");
            var dataInfo = node.getAttribute("data-info");
	        var style = node.getAttribute("style");
            // console.log(`${cls} / ${dataInfo} / ${style}`)
            if (style && style.match("small-caps")) {
        	    ret = this.newdoc.createElement("span");
		        ret.setAttribute("class", "small-caps");
            } else if (cls && cls.match("cite") && dataInfo) {
                ret = this.newdoc.createElement(tn);
                ret.setAttribute("class", "cite");
                ret.setAttribute("data-info", dataInfo);
            } else if (node.getAttribute("style") && node.getAttribute("style").match(/(?:mso-tab-count|mso-spacerun)/)) {
                ret = this.newdoc.createElement("span");
                ret.setAttribute("class", "wide-space");
                var space = this.newdoc.createTextNode(" ");
                ret.appendChild(space);
	        } else {
                ret = false;
	        }
            // console.log(`Input node: ${node.nodeName}, Output node: ${ret}`);
            this.appendOrdinaryNode(node, ret)
        } else if (m[1] === "td") {
            ret = this.newdoc.createElement("td");
            var rowspan = node.getAttribute("rowspan")
            if (rowspan) {
                ret.setAttribute("rowspan", rowspan);
            }
            var style = node.getAttribute("style");
            if (style && style.match(/background:#D0CECE;/)) {
                ret.setAttribute("class", "grey-box");
            }
            this.appendOrdinaryNode(node, ret)
        } else {
	        ret = this.newdoc.createElement(tn);
            this.appendOrdinaryNode(node, ret)
        }
    }
}

Walker.prototype.fixFieldObj = function(fieldObj) {
    // Fix jurisdiction field values
    for (var itemObj of fieldObj.citationItems) {
        if (itemObj.itemData.jurisdiction) {
            itemObj.itemData.jurisdiction = this.jurisdictionMap[itemObj.itemData.jurisdiction];
        }
        var itemKey = itemObj.uri[0].split("/").pop();
        itemObj.itemData.id = itemKey;
    }
    return fieldObj;
}

Walker.prototype.buildDataInfo = function(fieldObj) {
    var arr = [];

    fieldObj = this.fixFieldObj(fieldObj);
    
    // console.log(JSON.stringify(fieldObj, null, 2));

    for (var citationItem of fieldObj.citationItems) {
 
        var info = [];
        var m = citationItem.prefix.match(this.reverseSignalRex)
        if (m) {
            var prefixSignalCode = this.reverseSignalMap[m[1]];
            info.push(prefixSignalCode);
        } else {
            info.push("none");
        }
        info.push(citationItem.itemData.id);
        var positionCode = "0";
        info.push(positionCode);
        var suppressAuthor = citationItem["suppress-author"] ? "1" : "0";
        info.push(suppressAuthor);
        if (citationItem.locator) {
            info.push(citationItem.locator);
        }
        arr.push(info.join("-"));
    }
    
    var ret = arr.join("++");
    return ret;
}

Walker.prototype.writeItemDataFileOrFiles = function(fieldObj) {
    for (var itemObj of fieldObj.citationItems) {
        var itemData = itemObj.itemData;
        var pth = itemDataPath(`${itemData.id}.json`);
        if (!fs.existsSync(pth)) {
            fs.writeFileSync(pth, JSON.stringify(itemData, null, 2));
            // console.log(`Wrote ${itemData.id}.json`);
        }

    }
}

Walker.prototype.processInputTree = function(node) {
    if (node.tagName === "body") {
	    for(var i=0; i<node.childNodes.length; i++) {
        var child = node.childNodes[i];
		    this.processInputTree(child);
	    }
        return;
    }
    var type = this.getNodeType(node);
    if (type === "text") {
        var content = node.nodeValue;
        content = content.replace(/(?:&nbsp;)+/g, " ");
        content = content.replace(/\s+/g, " ");
        content = content.replace(/&amp;/g, "&");
        content = content.replace(/&gt;/g, ">");
        content = content.replace(/&lt;/g, "<");
        content = content.replace(/&quot;/g, '"');
	    var newnode = this.newdoc.createTextNode(content);
	    this.getTarget().appendChild(newnode);
    } else if (type === "node") {
	    var style = node.getAttribute("style");
	    if (style && style.match(/mso-list:Ignore/)) return;
        // No singletons. What about BR and HR?
	    if (node.childNodes.length > 0) {
	        this.fixNodeAndAppend(node);
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
                var fieldJSON = fieldBody.firstChild.textContent.slice(32).replace(/&quot;/g, '"').replace(/(\r\n|\n|\r)/gm, " ").trim();
                var fieldObj = JSON.parse(fieldJSON);

                // Write data file(s) for this citation if required
                var fieldID = this.buildDataInfo(fieldObj);
                this.writeItemDataFileOrFiles(fieldObj);

                // Add wrapper to the citation object in the output DOM
                var wrapper = this.newdoc.createElement("span");
                wrapper.setAttribute("class", "cite");
                wrapper.setAttribute("data-info", fieldID);
                this.fixNodeAndAppend(wrapper);
            }
        }
    }
}

/*
Unfortunately, the Jurism data embedded in the document does not
contain positional information. There's no easy way around that,
since the position parameter is dynamic, and cannot be set
manually through the document UI.

var positionMap = {
    "0": "First reference",
    "1": "Subsequent reference",
    "2": "Id. reference",
    "3": "Id. reference with locator"
};
*/

/*
*/

var inputFile = process.argv[2];

if (inputFile && inputFile.slice(-5) === ".html") {
    var res = domifyInput(inputFile);
} else {
    var err = new Error("Run this script with an HTML source file as argument");
    console.log(err.message);
    process.exit();
}

// Need to get filename stump, and save under ./docs under the same name in run();
// Give run() an argument?

const walker = new Walker(res.doc, newdoc);
walker.run(res.filename);
console.log("  Generated files are under ./docs");
