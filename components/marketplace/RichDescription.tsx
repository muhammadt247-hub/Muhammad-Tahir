import React from 'react';

// Shows vendor text with simple formatting: # headings, - lists and **bold**.
// It only builds plain text elements, so nothing a vendor writes can run as code or add links.

function inline(text: string, keyBase: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={keyBase + i} className="font-semibold text-foreground">
        {part.slice(2, -2).trim()}
      </strong>
    ) : (
      <React.Fragment key={keyBase + i}>{part}</React.Fragment>
    )
  );
}

export function RichDescription({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flushList = (key: string) => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={'ul' + key} className="list-disc pl-5 space-y-0.5 text-sm text-muted-foreground">
        {list.map((item, i) => (
          <li key={i}>{inline(item, key + '-' + i + '-')}</li>
        ))}
      </ul>
    );
    list = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    const key = String(idx);
    if (line === '') {
      flushList(key);
      return;
    }
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1]);
      return;
    }
    flushList(key);
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      blocks.push(
        <p
          key={'h' + key}
          className={level === 1 ? 'text-base font-bold text-foreground' : 'text-sm font-bold text-foreground pt-1'}
        >
          {inline(h[2], key + '-')}
        </p>
      );
      return;
    }
    blocks.push(
      <p key={'p' + key} className="text-sm text-muted-foreground">
        {inline(line, key + '-')}
      </p>
    );
  });
  flushList('end');

  return <div className="space-y-1.5 break-words">{blocks}</div>;
}
