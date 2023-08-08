const fs = require("fs");
const os = require("os");
const path = require("path");
const dom = require("htmldom2").DOMParser;
const serializer = require("htmldom2").XMLSerializer;
const xpath = require("xpath");
const pretty = require('pretty');
const slugify = require('slugify');

var urlTypes = JSON.parse(fs.readFileSync("url-types.json").toString());

const monthName = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const getCurrentDate = () => {
    var d = new Date();
    var year = d.getFullYear();
    var month = monthName[d.getMonth()];
    var date = d.getDate();
    return `${month} ${date}, ${year}`;
}

const getHash = () => {
    return require('child_process')
        .execSync('git rev-parse --short HEAD')
        .toString().trim();
}

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
    <title>Indigo Book 2.0</title>
    <style>
      @page {
          border: 0; margin-left: .75in;
          margin-right: .75in;
          margin-top: .75in;
          margin-bottom: .75in;
          widows:2;
      }
      @page frontmatter {
        @bottom {
          content: counter(page, lower-roman);
          font-family: 'Libre Baskerville', Georgia, serif;
          font-style: italic;
        }
      }
      @page frontmatter:first {
        @bottom {
          content: none;
        }
      }
	  @page :first {
		@top-right { content: normal }
		@bottom-right { content: normal }
		margin: 0 ; 
	  }
      @page contents:left {
          @top-left {
              content: 'The Indigo Book';
              font-family: 'Libre Baskerville', Georgia, serif;
              font-style: italic;
          }
          @bottom-left {
              content: counter(page);
              font-family: 'Libre Baskerville', Georgia, serif;
              font-style: italic;
          }
          @bottom-right {
              content: 'indigobook-2.0-rev2023-1';
              font-family: Arial, Calibri, Helvetica;
              font-size: 9pt;
          }
      } 
      @page contents:right {
          @top-right {
              content: string(title);
              font-family: 'Libre Baskerville', Georgia, serif;
              font-style: italic;
          }
          @bottom-right {
              content: counter(page);
              font-family: 'Libre Baskerville', Georgia, serif;
              font-style: italic;
          }
          @bottom-left {
              content: 'indigobook-2.0-rev2023-1';
              font-family: Arial, Calibri, Helvetica;
              font-size: 9pt;
          }
      }
      #frontmatter { counter-reset: page 0; page: frontmatter }
      #contents { counter-reset: page 1; page: contents }
      #toc li { list-style-type: none }
      #toc a:after {
          content: leader('.') target-counter(attr(href), page);
      }
      #toc li a.h3 { margin-left: 2em; }
      #toc li a.h4 { margin-left: 4em; }
      #toc li a.h5 { margin-left: 6em; }
      h2 { break-before: page }
      body {
          font-family:'Libre Baskerville', Georgia, serif;
          font-size:12pt;
          line-height:18pt;
      }
      p.no-break-after {
          page-break-after: avoid;
      }
      .page-break { page-break-before: always; }
      h2 {
          color: #990000;
          font-size: 16pt;
          line-height: 18pt;
          margin-top: 22px;
          padding-bottom: 5px;
          margin-bottom: 0px;
          text-indent: 0px;
          string-set: title contents;
          font-weight: bold;
      }
      h2.link-note {
         font-family:"Calibri",sans-serif;
         font-weight:normal;
         font-size:13pt;
         color:#2F5496;
         string-set: none;
      }
      h3 {
          padding-bottom: 5px;
          margin-bottom: 0px;
          text-indent: 0px;
      }
      h4 {
          text-indent: 0;
          font-size: 14pt;
          margin-bottom: 12px;
      }
      h5 {
          margin-top:0px;
          text-indent: 0;
          font-size: 12pt;
          margin-bottom: 10px;
      }
      h5 span.wide-space {
          width: 1em;
          display:inline-block;
      }
      h2 a, h3 a, h4 a, h5 a {
          text-decoration: none;
          font-weight: inherit;
          font-style: inherit;
          color: inherit;
      }
      p {
          text-align: left;
          margin: 0;
          direction: ltr;
          padding-bottom: 9px;
          color: #000;
          text-indent: 0;
      }
      p.title-block {
        margin-top:auto;
        margin-bottom:auto;
        text-align:center;
        line-height:32.0pt;
        background:#442327;
        vertical-align:middle;
      }
      p.title-block.first {
        padding-top:20pt;
      }
      p.title-block.subtitle {
        line-height:18.0pt;
      }
      a {
          font-style: normal;
          font-weight: normal;
          color: #900;
      }
      .inkling-box {
          border: 2px solid #4B0082;
          padding: 10px;
          background-color: rgba(75, 0, 130,0.05);
          margin-top: 19px;
          margin-bottom: 6px;
      }
      .inkling-title {
          font-variant: small-caps;
          color: #4B0082;
          font-weight: bold;
          page-break-after: avoid;
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
      .small-caps {
          font-variant: small-caps;
      }
    /*
        CSS for the cover (start)
    */
    main, nav { display: block ; }
	.offscreen {
		 position: absolute;
		 width: 1px;
		 height: 1px;
		 margin: -1px;
		 padding: 0;
		 overflow: hidden;
		 clip: rect(1px 1px 1px 1px); /* IE6, IE7 */
	     clip: rect(1px, 1px, 1px, 1px);
		 border: 0;
	}
	:focus.offscreen {
		 width: auto;
		 height: auto;
		 margin: 0;
		 overflow: auto;
		 clip: auto;
		 display: block;
		 background: #eee;
		 color: #000;
		 text-decoration: underline; 
		 padding: 1em;
	}
    
	svg.scale {width: 100%; height: auto;}
	svg.centered { margin-left: auto; margin-right: auto; display: block; }

    div.offscreen h2 { prince-bookmark-level: none }
	div.cover { background-color: #442327 ; padding: 50px; vertical-align: middle ;   }
	div.cover h1 { text-align: center ; color: #dfbb92 ; font-variant: small-caps ; font-size: 21pt; line-height: 32pt; }
	div.cover h1 .display { font-size: 54pt; font-variant: small-caps ;   }
	div.cover h1 .small-display { font-size: 36pt; }
	div.cover h1 .smaller-display { font-size: 18pt; }
	div.cover p.subtitle { text-align: center ; color: #dfbb92; font-size: 18pt ; padding-top: 20px ; padding-bottom: 20px;  }
	div.cover p.subwarn { text-align: center ; color: #dfbb92; font-size: 12pt; text-transform: uppercase ;  }

    h1, p.subtitle, p.subwarn { font-family: Alice, Georgia, serif ; }
    
	@media print { 
		div.cover { position: absolute; height: 11in; margin-left: 0; margin-top: 0; width: 7.5in; }
        hr { display: none; }
	}
    

    /*
        CSS for the cover (end)
    */
    
      /*
      tbody td.multicol {
          background: #fffcc5;
          border: 2px solid #888;
      }
      */
    </style>
  </head>
  <body></body>
</html>
`.trim();

/*
 * Conversion factory
 */
function Walker (inputFile) {
    var res = domifyInput(inputFile);
    this.fileName = res.filename;
    this.doc = res.doc;
    this.body = xpath.select("//body", this.doc)[0];
    this.newdoc = new dom().parseFromString(template, "text/html");
    this.newbody = xpath.select("//body", this.newdoc)[0];

    this.citePos = 1;
    this.listType = "ul";
    this.didTab = false;
    this.insideInkling = false;
    this.listLevel = 0;
    this.listID = null;
    this.inTitle = false;
    this.inHeading = false;
    this.targetMatchCount = 0;
    this.inAnchor = false;
    
    
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

Walker.prototype.slugify = function(str) {
    str = str.trim();
    str = str.replace(/\./g, " ");
    str = str.replace(/&amp;/g, "and");
    str = str.replace(/&nbsp;/g, " ");
    str = str.replace(/\s\s+/g, " ");
    return slugify(str, {
        lower:true
    })
}

Walker.prototype.getNodeType = function(node) {
    if (!node) return "EMPTY";
    return this.processTypes[node.nodeType];
}

Walker.prototype.fixEntities = function(output) {
    output = output.replace(/&amp;#8217;/g, "\u2019")
        .replace(/&amp;#8211;/g, "\u2013")
        .replace(/&amp;#8220;/g, "\u201C")
        .replace(/&amp;#8221;/g, "\u201D")
        .replace(/&amp;#8212;/g, "\u2014")
        .replace(/&amp;#8212;/g, "\u2014")
        .replace(/&amp;sect;/g, "\u00A7")
        .replace(/&amp;para;/g, "\u00B6")
        .replace(/&amp;#8658;/g, "\u21D2");
    return output
}

Walker.prototype.run = function(returnDOM) {
    // Purge p nodes that produce no meaningful output.
    // This is necessary to avoid confusion in read-ahead
    // handling of Inklings
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
    var tagList = ["p", "b", "i", "blockquote", "h1", "h2", "h3", "h4", "h5", "a", "u"];
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
    // console.log(`targetMatchCount: ${this.targetMatchCount}`);
    if (returnDOM) {
        return this.newdoc;
    } else {
        var output = pretty((new serializer()).serializeToString(this.newdoc));
        output = this.fixEntities(output);
        output = `<!DOCTYPE html>
${output}`;
        fs.writeFileSync(`${buildPath(this.fileName)}`, output);
        // console.log(pretty((new serializer()).serializeToString(this.newdoc)))
        console.log("  Generated files are under ./docs");
    }
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
            var noBreakAfter = false;
            if (this.getIndent(inputNode)) {
                if (outputNode.getAttribute("class") === "no-break-after") {
                    noBreakAfter = true;
                }
                outputNode = this.newdoc.createElement("blockquote");
                if (noBreakAfter) {
                    outputNode.setAttribute("class", "no-break-after");
                }
            }
            this.addTarget(outputNode);
        }
        for(var i=0; i<inputNode.childNodes.length; i++) {
            var child = inputNode.childNodes[i];
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
    if (!bulletOrNumber) {
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
            this.listLevel--;
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
            this.processInputTree(child);
        }
    
    var nextNode = inputNode.nextSibling;
    while (this.getNodeType(nextNode) === "text") {
        nextNode = nextNode.nextSibling;
    }
    if (!nextNode || !nextNode.getAttribute("class") || nextNode.getAttribute("class") !== "Inkling") {
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
            this.processInputTree(child);
        }

    var nextNode = inputNode.nextSibling;
    while (this.getNodeType(nextNode) === "text") {
        nextNode = nextNode.nextSibling;
    }
    if (!nextNode || !nextNode.getAttribute("class") || nextNode.getAttribute("class") !== "Inkling") {
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
    var m = tn.match(/(table|thead|tbody|span|h[0-9]|sup|tr|td|ul|ol|li|br|p|i|b|a|u)/);
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
                //console.log("OPEN (a)");
                // List formatting in Word HTML output is awful
                this.appendOpeningListNode(node, listInfo.level);
                this.listLevel = listInfo.level;
            } else if (cls === "MsoListParagraphCxSpMiddle" && listInfo.level) {
                //console.log("   MIDDLE (a)");
                // List formatting in Word HTML output is awful
                this.appendMiddleListNode(node, listInfo.level);
                this.listLevel = listInfo.level;
            } else if (cls === "MsoListParagraphCxSpLast" && listInfo.level) {
                //console.log("CLOSE(a)");
                // List formatting in Word HTML output is awful
                this.appendClosingListNode(node, listInfo.level);
                this.listLevel = listInfo.level-1;
            } else if (cls === "MsoListParagraph" && listInfo.level) {
                //console.log("ONE-OFF LIST BULLET");
                // List formatting in Word HTML output is awful
                this.appendSoloListNode(node, listInfo.level);
            } else if (/* cls === "Body" && */ !this.listLevel && listInfo.level) {
                //console.log(`OPEN (b)`);
                // List formatting in Word HTML output is awful
                this.appendOpeningListNode(node, listInfo.level);
                this.listLevel = listInfo.level;
            } else if (/* cls === "Body" && */ listInfo.nextElementSiblingIsList && listInfo.level) {
                // List formatting in Word HTML output is awful
                //console.log("  MIDDLE (b)");
                this.appendMiddleListNode(node, listInfo.level);
                this.listLevel = listInfo.level;
            } else if (/* cls === "Body" && */ !listInfo.nextElementSiblingIsList && listInfo.level) {
                // List formatting in Word HTML output is awful
                //console.log("CLOSE (b)");
                this.appendClosingListNode(node, listInfo.level);
                this.listLevel = listInfo.level-1;
            } else if (this.listLevel && !this.getIndent(node)) {
                // Close any list node that might be open when we hit this?
                //console.log("CLOSE (b')");
                // this.appendClosingListNode(node, listInfo.level);
                this.dropTarget();
                this.dropTarget();
                this.listLevel = 0;
            } else {
                var align = node.getAttribute("align");
                if (align === "center") {
                    if (style.indexOf("mso-line-height-alt") > -1) {
                        if (this.inTitle) {
                            ret.setAttribute("class", "title-block");
                        } else {
                            ret.setAttribute("class", "title-block first");
                        }
                    } else {
                        ret.setAttribute("class", "title-block subtitle");
                    }
                    this.inTitle = true;
                    ret.setAttribute("align", "center");
                } else {
                    this.inTitle = false;
                    if (node.textContent.match(/^\s*Examples?:?\s*(&nbsp;| )*$/)) {
                        ret.setAttribute("class", "no-break-after");
                    }
                }
                if (node.childNodes.length > 0) {
                    this.appendOrdinaryNode(node, ret);
                }
            }
        } else if (m[1] === "span") {
            var cls = node.getAttribute("class");
            var dataInfo = node.getAttribute("data-info");
            var style = node.getAttribute("style");
            if (style && this.inTitle) {
                ret = this.newdoc.createElement("span");
                ret.setAttribute("style", style);
            } else if (cls && cls.match("cite") && dataInfo) {
                ret = this.newdoc.createElement(tn);
                ret.setAttribute("class", "cite");
                ret.setAttribute("data-info", dataInfo);
            } else if (node.getAttribute("style") && node.getAttribute("style").match(/(?:mso-tab-count|mso-spacerun)/)) {
                ret = this.newdoc.createElement("span");
                ret.setAttribute("class", "wide-space");
                var space = this.newdoc.createTextNode(" ");
                ret.appendChild(space);
            } else if (style && style.match("small-caps")) {
                ret = this.newdoc.createElement("span");
                ret.setAttribute("class", "small-caps");
            } else {
                ret = false;
            }
            this.appendOrdinaryNode(node, ret)
        } else if (m[1] === "td") {
            ret = this.newdoc.createElement("td");
            var rowspan = node.getAttribute("rowspan")
            if (rowspan) {
                ret.setAttribute("rowspan", rowspan);
            }
            var colspan = node.getAttribute("colspan")
            if (colspan) {
                ret.setAttribute("colspan", colspan);
                // Check for any non-whitespace text to which boldface is not applied.
                var copyOfNode = node.cloneNode(true);
                var boldtext = copyOfNode.getElementsByTagName("b")[0];
                if (boldtext) {
                    boldtext.parentNode.removeChild(boldtext);
                    var strippedContent = copyOfNode.textContent.trim();
                    if (strippedContent) {
                        ret.setAttribute("class", "multicol");
                    }
                } else {
                    ret.setAttribute("class", "multicol");
                }
            }
            var style = node.getAttribute("style");
            if (style && style.match(/background:#D0CECE;/)) {
                ret.setAttribute("class", "grey-box");
            }
            this.appendOrdinaryNode(node, ret);
        } else if (["h2", "h3", "h4", "h5"].indexOf(m[1]) > -1) {
            if (this.listLevel > 0) {
                this.raiseNestingLevel(0);
            }
            ret = this.newdoc.createElement(tn);
            if (node.textContent === "Skip Links") {
                ret.setAttribute("class", "link-note");
            }
            if (node.textContent.trim() === "Introduction") {
                ret.setAttribute("id", "introduction");
            } else {
                var str = node.textContent.split("\n").join(" ").split("\r").join("");
                var m = str.match(/^([A-Z]\.\ .*|[TR][0-9]([.0-9]*[0-9])*)/);
                if (m) {
                    ret.setAttribute("id", this.slugify(m[1]));
                }
            }

            this.inHeading = true;
            this.appendOrdinaryNode(node, ret);
            this.inHeading = false;
        } else if (m[1] === "a") {
            // Fix dynamic links broken by LibreOffice HTML save.
            var href = node.getAttribute("href").replace("&amp;", "&");
            var skipAnchor = false;
            if (urlTypes.embedded.indexOf(href) > -1) {
                skipAnchor = true;
            }
            if (href && !skipAnchor) {
                ret = this.newdoc.createElement("a");
                ret.setAttribute("href", href);
                // For external links only, open in a new tab
                if (href.match(/^https?:\/\//)) {
                    ret.setAttribute("target", "_blank");
                }
            } else {
                ret = false;
            }
            this.inAnchor = true;
            this.appendOrdinaryNode(node, ret);
            this.inAnchor = false;
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
        content = content.split("\n").join(" ").split("\r").join("");
        
        // Create anchors for Rule and Table internal cross-references
        
        var newnode;
        if (!this.inHeading && !this.inAnchor) {
            var lst = content.split(/((?:Table|Rule)*\s(?:[TR][0-9](?:[.0-9]*[0-9])*))/);
            this.targetMatchCount = this.targetMatchCount + ((lst.length - 1) / 2);
            for (var i=0,ilen=lst.length;i<ilen;i++) {
                var str = lst[i];
                if (!str) continue;
                if (i%2 === 0) {
                    newnode = this.newdoc.createTextNode(str);
                } else if (i%2 === 1) {
                    var slug = this.slugify(str.replace(/^(?:Table|Rule)\s/, ""));
                    newnode = this.newdoc.createElement("a");
                    newnode.setAttribute("href", `#${slug}`);
                    var strNode = this.newdoc.createTextNode(str);
                    newnode.appendChild(strNode);
                }
                this.getTarget().appendChild(newnode);
            }
       } else {
            if (content.match(/^https?:\/\/[^\s]+$/)) {
                // Insert a zero-width space before certain characters
                var m = content.match(/(https?:\/\/)(.*)/);
                str = m[2].replace(/([-&?_\/])/g, "​$1");
                content = `${m[1]}${str}`;
            }
            newnode = this.newdoc.createTextNode(content);
            this.getTarget().appendChild(newnode);
        }
    } else if (type === "node") {
        var style = node.getAttribute("style");
        if (style && style.match(/mso-list:Ignore/)) return;
        // No singletons. What about BR and HR?
        if (node.tagName === "br" | node.tagName === "td" | node.childNodes.length > 0) {
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

Walker.prototype.buildTOC = function(doc, node, toc) {
    if (["h2", "h3", "h4", "h5"].indexOf(node.tagName) > -1) {
        this.tocEntryCount++;
        if (this.tocEntryCount > this.tocOffset) {
            var myid = node.getAttribute("id");
            // Build ToC entry node and append
            var str = node.textContent.split("\n").join(" ").split("\r").join("");
            var tocLi = doc.createElement("li");
            var tocAnchor = doc.createElement("a");
            tocLi.appendChild(tocAnchor);
            tocAnchor.setAttribute("href", `#${myid}`);
            tocAnchor.setAttribute("id", `toc_${myid}`);
            var tocText = doc.createTextNode(str);
            tocAnchor.setAttribute("class", node.tagName);
            tocAnchor.appendChild(tocText);
            toc.appendChild(tocLi);
            // Wrap heading in link back up to ToC
            var headingAnchor = doc.createElement("a");
            headingAnchor.setAttribute("href", `#toc_${myid}`);
            var len = node.childNodes.length;
            for (var i=0; i<len; i++) {
                var elem = node.childNodes[0].cloneNode(true);
                node.removeChild(node.childNodes[0]);
                headingAnchor.appendChild(elem);
            }
            node.appendChild(headingAnchor);
        }
    }
    if (node.childNodes) {
        for(var i=0; i<node.childNodes.length; i++) {
            var child = node.childNodes[i];
            this.buildTOC(doc, child, toc);
        }
    }
}

Walker.prototype.setTOC = function(doc) {
    this.tocOffset = 8;
    this.tocEntryCount = 0;
    var toc = doc.createElement("ol");
    toc.setAttribute("id", "toc");
    var body = xpath.select("//body", doc)[0];
    this.buildTOC(doc, body, toc);
    
    var tocNode = xpath.select('//p[text()="[ToC]"]|//span[text()="[ToC]"]', doc)[0];
    if (tocNode) {
        if (tocNode.tagName === "span") {
            tocNode = tocNode.parentNode;
        }
        var hruleNode = doc.createElement("hr");
        tocNode.parentNode.insertBefore(hruleNode, tocNode);
        
        var tocTitleNode = doc.createElement("h2");
        var tocTitleText = doc.createTextNode("Table of Contents");
        tocTitleNode.appendChild(tocTitleText);
        tocNode.parentNode.insertBefore(tocTitleNode, tocNode);
        
        tocNode.parentNode.replaceChild(toc, tocNode);
    }
}

Walker.prototype.setDate = function(doc) {
    var dateNode = xpath.select('//b[text()="[DATE]"]|//span[text()="[DATE]"]', doc)[0];
    var dateText = doc.createTextNode(getCurrentDate());
    dateNode.parentNode.replaceChild(dateText, dateNode);
}

Walker.prototype.setHash = function(doc) {
    var hash = getHash();
    var hashNode = xpath.select('//b[text()="[HASH]"]|//span[text()="[HASH]"]', doc)[0];
    if (hashNode) {
        var hashText = doc.createTextNode(hash);
        hashNode.parentNode.replaceChild(hashText, hashNode);
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


// Need to get filename stump, and save under ./docs under the same name in run();
// Give run() an argument?





if (require.main === module) {
    var getOpt = require("node-getopt");
    var opt = getOpt.create([
        ["i", "input-file=ARG", "File for input"],
        ["h", "help", "Display this help"]
    ])
        .bindHelp()
        .parseSystem();
    if (!opt.options.i) {
        var err = new Error("Run this script with an HTML source file as -i argument");
        console.log(err.message);
        opt.showHelp();
        process.exit();
    }
    const walker = new Walker(opt.options.i);
    walker.run();
} else {
    module.exports = Walker;
}
