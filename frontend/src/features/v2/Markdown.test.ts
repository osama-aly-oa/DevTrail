import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Markdown } from './Markdown';
import { externalUrl, splitList } from './format';

describe('session note rendering', () => {
  it('renders fenced code, list items and HTTP links without interpreting raw markup', () => {
    const html = renderToStaticMarkup(createElement(Markdown, {
      text: ['<strong>literal</strong>', '- One\n- Two', '[Docs](https://example.com/docs)',
        '```ts\nconst tag = "<script>";\n```'].join('\n\n'),
    }));
    expect(html).toContain('&lt;strong&gt;literal&lt;/strong&gt;');
    expect(html).toContain('<ul><li>One</li><li>Two</li></ul>');
    expect(html).toContain('href="https://example.com/docs"');
    expect(html).toContain('<pre><code>const tag = &quot;&lt;script&gt;&quot;;</code></pre>');
  });

  it('renders unsupported link protocols as plain text', () => {
    const html = renderToStaticMarkup(createElement(Markdown, { text: '[Local instructions](file:///guide.md)' }));
    expect(html).toContain('[Local instructions](file:///guide.md)');
    expect(html).not.toContain('href=');
    expect(externalUrl('https://owner:credential@example.com/docs')).toBeUndefined();
  });

  it('deduplicates labels and preserves case-sensitive URL paths', () => {
    expect(splitList('React, react\nPostgreSQL')).toEqual(['React', 'PostgreSQL']);
    expect(splitList('https://example.com/A\nhttps://example.com/a', 'links'))
      .toEqual(['https://example.com/A', 'https://example.com/a']);
  });
});
