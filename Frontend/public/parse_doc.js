const fs = require("fs");
const doc = fs.readFileSync("inv_tmp/word/document.xml", "utf8");

// Find all tables and paragraphs structure
let pos = 0;
const elements = [];

// Find tbl positions
const tblRe = /<w:tbl>/g;
let m;
while ((m = tblRe.exec(doc)) !== null) elements.push({ type: "tbl_start", pos: m.index });

// Find all top-level text (outside tables) - look for paragraphs with text
const allText = doc.matchAll(/(?<=<w:t[^>]*>)[^<]+/g);
for (const match of allText) {
  if (match[0].trim()) elements.push({ type: "text", pos: match.index, val: match[0].trim() });
}

elements.sort((a, b) => a.pos - b.pos);

// Print structure
let inTable = 0;
let tableIdx = 0;
elements.forEach(el => {
  if (el.type === "tbl_start") {
    tableIdx++;
    console.log(">>> TABLE " + tableIdx + " START at " + el.pos);
    inTable = tableIdx;
  } else if (inTable === 0 || el.pos > 65000) {
    console.log("TXT[" + el.pos + "]: " + el.val);
  }
});
