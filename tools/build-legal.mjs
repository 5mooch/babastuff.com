// Turns ../../TERMS.md and ../../PRIVACY.md into site/terms/ and site/privacy/.
// Run from the site folder: node tools/build-legal.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(SITE, '..');

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function inline(s) {
  const links = [];
  s = s.replace(/<(https?:\/\/[^>]+)>/g, (_, u) => (links.push(`<a href="${u}">${esc(u)}</a>`), `\u0000${links.length - 1}\u0000`));
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, t, u) => (links.push(`<a href="${u}">${esc(t)}</a>`), `\u0000${links.length - 1}\u0000`));
  s = esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\s)_(.+?)_(?=\s|$|[.,])/g, '$1<em>$2</em>')
    .replace(/\b([\w.+-]+@babastuff\.com)\b/g, '<a href="mailto:$1">$1</a>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => links[i]);
}
function md(src) {
  const out = []; let para = []; const stack = []; // stack of list indents
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const closeLists = (to = -1) => { while (stack.length && stack[stack.length - 1] > to) { out.push('</li></ul>'); stack.pop(); } };
  let title = '';
  for (const line of src.split('\n')) {
    const li = line.match(/^(\s*)- (.*)$/);
    if (li) {
      flushPara(); const ind = li[1].length;
      if (!stack.length || ind > stack[stack.length - 1]) { out.push('<ul><li>'); stack.push(ind); }
      else { closeLists(ind); out.push('</li><li>'); }
      out.push(inline(li[2])); continue;
    }
    if (!line.trim()) { flushPara(); continue; }
    closeLists();
    const h = line.match(/^(#{1,3}) (.*)$/);
    if (h) { flushPara(); if (h[1] === '#') title = h[2]; out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }
    para.push(line.trim());
  }
  flushPara(); closeLists();
  return { title, body: out.join('\n') };
}

const page = (title, short, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(short)} | Babastuff</title>
<meta name="description" content="${esc(title)}.">
<link rel="icon" href="../favicon.png">
<style>
  :root { --bg:#f6f6f8; --card:#ffffff; --text:#16161a; --muted:#5d5d66; --line:#e3e3e8; --accent:#3b6cf6; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0f0f12; --card:#18181d; --text:#f2f2f5; --muted:#a2a2ad; --line:#2a2a31; --accent:#7b9dff; }
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text);
         font:17px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  main { max-width:720px; margin:0 auto; padding:56px 16px 40px; }
  header { font-weight:700; font-size:20px; letter-spacing:-.01em; margin-bottom:40px; }
  header a { color:inherit; text-decoration:none; }
  article { background:var(--card); border:1px solid var(--line); border-radius:20px; padding:28px; overflow-wrap:anywhere; }
  h1 { font-size:28px; line-height:1.2; margin:0 0 8px; letter-spacing:-.02em; }
  h2 { font-size:20px; margin:32px 0 10px; letter-spacing:-.01em; }
  p { margin:0 0 14px; }
  ul { margin:0 0 14px; padding-left:22px; }
  ul ul { margin:6px 0 0; }
  li { margin:6px 0; }
  em { color:var(--muted); font-style:normal; }
  a { color:var(--accent); }
  footer { margin-top:40px; color:var(--muted); font-size:14px; }
  footer a { color:var(--muted); }
</style>
</head>
<body>
<main>
  <header><a href="../">Babastuff</a></header>
  <article>
${body}
  </article>
  <footer>
    <a href="../">Home</a> &middot; <a href="../terms/">Terms</a> &middot; <a href="../privacy/">Privacy</a> &middot; <a href="mailto:support@babastuff.com">support@babastuff.com</a>
  </footer>
</main>
</body>
</html>
`;

for (const [file, dir, short] of [['TERMS.md', 'terms', 'Terms of sale'], ['PRIVACY.md', 'privacy', 'Privacy policy']]) {
  const { title, body } = md(readFileSync(join(ROOT, file), 'utf8'));
  mkdirSync(join(SITE, dir), { recursive: true });
  writeFileSync(join(SITE, dir, 'index.html'), page(title, short, body));
  console.log(`${dir}/index.html  ←  ${file}`);
}
