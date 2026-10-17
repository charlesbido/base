/**
 * A deliberately tiny markdown renderer for "rich-ish" text (posts, docs, comments).
 * It builds React elements directly — never HTML strings — so user content can't inject markup.
 *
 * Supported: # / ## / ### headings, - or * bullets, 1. numbered lists, > quotes, blank-line
 * paragraphs, **bold**, *italic*, `code`, and [links](https://...) (http/https/mailto only).
 */
import { Anchor, Blockquote, Code, List, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <Code key={key}>{part.slice(1, -1)}</Code>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={key}>{part.slice(1, -1)}</em>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const href = link[2]!;
      if (/^(https?:|mailto:)/i.test(href)) {
        return (
          <Anchor key={key} href={href} target="_blank" rel="noopener noreferrer">
            {link[1]}
          </Anchor>
        );
      }
      return link[1];
    }
    return part;
  });
}

/** Inline text with soft line breaks preserved. */
function lines(text: string, key: string): ReactNode[] {
  return text.split('\n').flatMap((line, i) => (i === 0 ? inline(line, `${key}-${i}`) : [<br key={`${key}-br${i}`} />, ...inline(line, `${key}-${i}`)]));
}

export function Markdown({ source }: { source: string }) {
  const blocks = source.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return (
    <div className="camp-markdown">
      {blocks.map((block, b) => {
        const key = `b${b}`;
        const trimmed = block.trim();
        if (!trimmed) return null;
        const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
        if (heading && !trimmed.includes('\n')) {
          const order = (heading[1]!.length + 2) as 3 | 4 | 5;
          return (
            <Title key={key} order={order} mt="sm" mb={4}>
              {inline(heading[2]!, key)}
            </Title>
          );
        }
        const rows = trimmed.split('\n');
        if (rows.every((r) => /^\s*[-*]\s+/.test(r))) {
          return (
            <List key={key} mb="sm" spacing={2}>
              {rows.map((r, i) => (
                <List.Item key={i}>{inline(r.replace(/^\s*[-*]\s+/, ''), `${key}-${i}`)}</List.Item>
              ))}
            </List>
          );
        }
        if (rows.every((r) => /^\s*\d+[.)]\s+/.test(r))) {
          return (
            <List key={key} type="ordered" mb="sm" spacing={2}>
              {rows.map((r, i) => (
                <List.Item key={i}>{inline(r.replace(/^\s*\d+[.)]\s+/, ''), `${key}-${i}`)}</List.Item>
              ))}
            </List>
          );
        }
        if (rows.every((r) => r.startsWith('>'))) {
          return (
            <Blockquote key={key} mb="sm" p="sm">
              {lines(rows.map((r) => r.replace(/^>\s?/, '')).join('\n'), key)}
            </Blockquote>
          );
        }
        return (
          <Text key={key} mb="sm" style={{ overflowWrap: 'anywhere' }}>
            {lines(trimmed, key)}
          </Text>
        );
      })}
    </div>
  );
}
