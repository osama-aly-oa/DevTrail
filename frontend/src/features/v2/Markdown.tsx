import { externalUrl } from './format';
import './features.css';

function inline(text: string) {
  const tokens = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^\s)]+\))/g);
  return tokens.map((token, index) => {
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      return <code key={index}>{token.slice(1, -1)}</code>;
    }
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return <strong key={index}>{token.slice(2, -2)}</strong>;
    }
    const link = /^\[([^\]]+)\]\(([^\s)]+)\)$/.exec(token);
    const href = link?.[2] && externalUrl(link[2]);
    return href ? <a key={index} href={href} target="_blank" rel="noreferrer">{link[1]}</a> : token;
  });
}

export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/^```([\w+-]*)[ \t]*\r?\n([\s\S]*?)(?:\r?\n)?^```[ \t]*\r?$/gm);
  return <div className="v2-markdown" dir="auto">{blocks.map((block, index) => {
    if (index % 3 === 1) return null;
    if (index % 3 === 2) {
      const language = blocks[index - 1];
      return <div className="v2-code" key={index}>{language && <div>{language}</div>}<pre><code>{block}</code></pre></div>;
    }
    return block.trim().split(/\r?\n[ \t]*\r?\n/).filter(Boolean).map((paragraph, part) => {
      const key = index + '-' + part;
      const lines = paragraph.split(/\r?\n/);
      if (lines.every(line => /^\s*[-*]\s+/.test(line))) {
        return <ul key={key}>{lines.map((line, lineNumber) => <li key={lineNumber}>{inline(line.replace(/^\s*[-*]\s+/, ''))}</li>)}</ul>;
      }
      if (lines.every(line => /^\s*\d+\.\s+/.test(line))) {
        return <ol key={key}>{lines.map((line, lineNumber) => <li key={lineNumber}>{inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>)}</ol>;
      }
      return <div key={key} className="v2-markdown-paragraph">{lines.map((line, lineNumber) => {
        const heading = /^#{1,6}\s+(.+)$/.exec(line);
        if (heading?.[1]) return <h3 key={lineNumber}>{inline(heading[1])}</h3>;
        if (line.startsWith('> ')) return <blockquote key={lineNumber}>{inline(line.slice(2))}</blockquote>;
        return <div key={lineNumber}>{inline(line)}</div>;
      })}</div>;
    });
  })}</div>;
}
