/* Strip developer commentary from the SHIPPED artifacts.

   The repository keeps its annotations — they are the project's record of
   why every line is the way it is. What ships inside the APK does not need
   them: an .apk is a zip anyone can open, so www/app.js and www/index.html
   are effectively public, and internal notes, ticket numbers and names have
   no business travelling with a release build.

   Comments are removed with a real JavaScript parser rather than a regular
   expression: a division followed by a block comment and a regex literal
   containing a slash-star are indistinguishable to a pattern matcher and
   not to a parser, and getting that wrong silently corrupts code that
   still parses. (This very comment first closed itself early by containing
   the sequence it was describing.)

   Usage: node tools/scrub.mjs www/app.js www/index.html
*/
import { readFileSync, writeFileSync } from "fs";
import * as acorn from "acorn";

function stripJs(src) {
  const comments = [];
  acorn.parse(src, { ecmaVersion: "latest", onComment: comments, locations: false });
  let out = src;
  for (const c of comments.slice().sort((a, b) => b.start - a.start)) {
    const before = out.slice(0, c.start), after = out.slice(c.end);
    // keep a newline where a line comment sat so ASI cannot change meaning
    out = before + (c.type === "Line" ? "" : " ") + after;
  }
  return out;
}

function stripHtml(src) {
  let out = src.replace(/<!--[\s\S]*?-->/g, "");
  // CSS comments, but only inside <style> blocks — "https://" elsewhere is
  // not a comment and neither is anything in a data: URI
  out = out.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi,
    (m, attrs, css) => `<style${attrs}>${css.replace(/\/\*[\s\S]*?\*\//g, "")}</style>`);
  // inline scripts get the parser too
  out = out.replace(/<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/gi,
    (m, attrs, js) => {
      try { return `<script${attrs}>${stripJs(js)}</script>`; }
      catch { return m; }
    });
  return out;
}

let changed = 0;
for (const p of process.argv.slice(2)) {
  const src = readFileSync(p, "utf8");
  const out = p.endsWith(".js") ? stripJs(src) : stripHtml(src);
  if (p.endsWith(".js")) acorn.parse(out, { ecmaVersion: "latest" });  // must still parse
  writeFileSync(p, out);
  const saved = src.length - out.length;
  console.log(`  scrub ${p}: ${(saved / 1024).toFixed(0)} KB of commentary removed`);
  changed++;
}
if (!changed) console.log("  scrub: nothing to do");
