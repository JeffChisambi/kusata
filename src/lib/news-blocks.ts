/**
 * The article body format shared by the admin editor and the mobile app.
 *
 * An article body is stored as `string[]` — one string per block. Plain
 * strings are paragraphs, so every article written before the block editor
 * existed still reads correctly. Richer blocks use a small, human-readable
 * markup on the first characters of the string:
 *
 *   ## Heading text            → sub-heading
 *   ![Caption](https://…)      → inline image with an optional caption
 *   > Quote text               → pull quote; a trailing "— Name" line is the
 *   > — Attribution              attribution
 *   - item / - item / …        → bullet list, one item per line
 *   anything else              → paragraph
 *
 * Inside paragraph, heading, quote and list text, `**bold**` and `_italic_`
 * are the only inline marks. This file lives twice — kusata/src/lib/news-blocks.ts
 * and Pine/utils/newsBlocks.ts — and the two must agree on every byte.
 */

export type NewsBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "image"; url: string; caption: string }
  | { type: "quote"; text: string; attribution: string }
  | { type: "list"; items: string[] };

const IMAGE_RE = /^!\[([^\]]*)\]\((\S+?)\)\s*$/;

export function parseBlock(raw: string): NewsBlock {
  const s = raw.trim();
  const img = s.match(IMAGE_RE);
  if (img) return { type: "image", caption: img[1].trim(), url: img[2] };
  if (s.startsWith("## ")) return { type: "heading", text: s.slice(3).trim() };
  const lines = s.split("\n").map((l) => l.trim());
  if (lines.length > 0 && lines.every((l) => l.startsWith("- "))) {
    return { type: "list", items: lines.map((l) => l.slice(2).trim()).filter(Boolean) };
  }
  if (lines.every((l) => l.startsWith(">"))) {
    const body = lines.map((l) => l.replace(/^>\s?/, ""));
    const last = body[body.length - 1] ?? "";
    const attr = body.length > 1 && /^[—-]\s*/.test(last) ? last.replace(/^[—-]\s*/, "") : "";
    const text = (attr ? body.slice(0, -1) : body).join("\n").trim();
    return { type: "quote", text, attribution: attr };
  }
  return { type: "paragraph", text: s };
}

export function serializeBlock(b: NewsBlock): string {
  switch (b.type) {
    case "heading": return `## ${b.text.trim()}`;
    case "image": return `![${b.caption.trim()}](${b.url.trim()})`;
    case "quote": {
      const q = b.text.trim().split("\n").map((l) => `> ${l}`).join("\n");
      return b.attribution.trim() ? `${q}\n> — ${b.attribution.trim()}` : q;
    }
    case "list": return b.items.map((i) => `- ${i.trim()}`).filter((l) => l !== "- ").join("\n");
    default: return b.text.trim();
  }
}

export const parseBody = (body: string[]): NewsBlock[] => body.map(parseBlock);

/** Drops blocks with nothing in them so an empty editor row never publishes. */
export const serializeBody = (blocks: NewsBlock[]): string[] =>
  blocks.map(serializeBlock).filter((s) => s.trim() !== "");

export const isBlockEmpty = (b: NewsBlock): boolean => serializeBlock(b).trim() === "";

/** `**bold**` and `_italic_` runs. Unmatched markers are left as literal text. */
export type InlineRun = { text: string; bold?: boolean; italic?: boolean };

export function parseInline(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const re = /\*\*(.+?)\*\*|_(.+?)_/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    if (m[1] !== undefined) runs.push({ text: m[1], bold: true });
    else runs.push({ text: m[2], italic: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs.length ? runs : [{ text }];
}
