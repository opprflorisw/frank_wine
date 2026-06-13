import React from "react";

/* A tiny, dependency-free Markdown renderer that builds real React elements
   (no dangerouslySetInnerHTML). It is intentionally forgiving: it must never
   throw on arbitrary text, and gracefully degrades unknown syntax to plain
   text. Supports bold, italic, inline code, links, headings, ordered &
   unordered lists, paragraphs and line breaks. */

type Pattern = { re: RegExp; tag: "code" | "link" | "strong" | "em" };

// Order matters: earlier patterns win ties at the same index, and code/links
// are resolved before emphasis so their contents aren't re-parsed greedily.
const PATTERNS: Pattern[] = [
  { re: /`([^`]+)`/, tag: "code" },
  { re: /\[([^\]]+)\]\(([^)\s]+)\)/, tag: "link" },
  { re: /\*\*([\s\S]+?)\*\*/, tag: "strong" },
  { re: /__([\s\S]+?)__/, tag: "strong" },
  { re: /\*([^*\n]+?)\*/, tag: "em" },
  { re: /(?:^|\b)_([^_\n]+?)_(?:\b|$)/, tag: "em" },
];

/** Parse inline markdown within a single span of text into React nodes. */
function inline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let rest = text;
  let n = 0;
  // Hard cap iterations as a paranoia guard against pathological input.
  let guard = 0;
  while (rest.length && guard++ < 10000) {
    let best: { idx: number; full: string; node: React.ReactNode } | null = null;
    for (const p of PATTERNS) {
      const m = p.re.exec(rest);
      if (!m) continue;
      // For the word-boundary italic, the actual `_` may be offset; normalise
      // by using the full match start so slicing stays correct.
      const idx = m.index;
      if (best && idx >= best.idx) continue;
      const key = `n${n}`;
      let node: React.ReactNode;
      if (p.tag === "code") node = <code key={key}>{m[1]}</code>;
      else if (p.tag === "link")
        node = (
          <a key={key} href={m[2]} target="_blank" rel="noopener noreferrer">
            {inline(m[1])}
          </a>
        );
      else if (p.tag === "strong") node = <strong key={key}>{inline(m[1])}</strong>;
      else node = <em key={key}>{inline(m[1])}</em>;
      best = { idx, full: m[0], node };
    }
    if (!best) {
      out.push(rest);
      break;
    }
    if (best.idx > 0) out.push(rest.slice(0, best.idx));
    out.push(best.node);
    n++;
    rest = rest.slice(best.idx + best.full.length);
  }
  if (rest.length && guard >= 10000) out.push(rest);
  return out;
}

const UL_RE = /^\s*[-*•]\s+(.*)$/;
const OL_RE = /^\s*\d+[.)]\s+(.*)$/;
const H_RE = /^\s*(#{1,6})\s+(.*)$/;

export default function Markdown({ text }: { text: string }) {
  let blocks: React.ReactNode[] = [];
  try {
    const src = (text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = src.split("\n");
    let para: string[] = [];
    let b = 0;

    const flushPara = () => {
      if (!para.length) return;
      const parts: React.ReactNode[] = [];
      para.forEach((ln, idx) => {
        if (idx) parts.push(<br key={`br${idx}`} />);
        parts.push(...inline(ln));
      });
      blocks.push(<p key={`b${b++}`}>{parts}</p>);
      para = [];
    };

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === "") {
        flushPara();
        i++;
        continue;
      }

      const h = H_RE.exec(line);
      if (h) {
        flushPara();
        const Tag = (h[1].length <= 2 ? "h4" : "h5") as "h4" | "h5";
        blocks.push(<Tag key={`b${b++}`}>{inline(h[2])}</Tag>);
        i++;
        continue;
      }

      if (UL_RE.test(line)) {
        flushPara();
        const items: React.ReactNode[] = [];
        let j = 0;
        while (i < lines.length && UL_RE.test(lines[i])) {
          const it = UL_RE.exec(lines[i])![1];
          items.push(<li key={`li${j++}`}>{inline(it)}</li>);
          i++;
        }
        blocks.push(<ul key={`b${b++}`}>{items}</ul>);
        continue;
      }

      if (OL_RE.test(line)) {
        flushPara();
        const items: React.ReactNode[] = [];
        let j = 0;
        while (i < lines.length && OL_RE.test(lines[i])) {
          const it = OL_RE.exec(lines[i])![1];
          items.push(<li key={`li${j++}`}>{inline(it)}</li>);
          i++;
        }
        blocks.push(<ol key={`b${b++}`}>{items}</ol>);
        continue;
      }

      para.push(line);
      i++;
    }
    flushPara();
  } catch {
    // Never throw on arbitrary text — fall back to the raw string.
    blocks = [<p key="fallback">{text ?? ""}</p>];
  }

  return <div className="md">{blocks}</div>;
}
