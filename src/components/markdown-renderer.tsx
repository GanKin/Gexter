'use client';

import { Fragment, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

type MarkdownRendererProps = {
  content: string;
  className?: string;
};

type InlineToken = {
  key: string;
  node: ReactNode;
};

function isSpecialBlockStart(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('```') ||
    /^#{1,6}\s+/.test(trimmed) ||
    /^>\s?/.test(trimmed) ||
    /^(?:[-*+]\s+|\d+\.\s+)/.test(trimmed) ||
    /^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)
  );
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const tokens: InlineToken[] = [];
  let buffer = '';
  let index = 0;

  const flushBuffer = () => {
    if (buffer.length > 0) {
      tokens.push({ key: `text-${tokens.length}`, node: buffer });
      buffer = '';
    }
  };

  while (index < text.length) {
    const char = text[index];

    if (char === '`') {
      const end = text.indexOf('`', index + 1);
      if (end > index + 1) {
        flushBuffer();
        tokens.push({
          key: `code-${tokens.length}`,
          node: (
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">
              {text.slice(index + 1, end)}
            </code>
          ),
        });
        index = end + 1;
        continue;
      }
    }

    if (char === '[') {
      const closeBracket = text.indexOf(']', index + 1);
      const openParen = closeBracket >= 0 ? text.indexOf('(', closeBracket + 1) : -1;
      const closeParen = openParen >= 0 ? text.indexOf(')', openParen + 1) : -1;

      if (closeBracket > index + 1 && openParen === closeBracket + 1 && closeParen > openParen + 1) {
        flushBuffer();
        const label = text.slice(index + 1, closeBracket);
        const href = text.slice(openParen + 1, closeParen);
        tokens.push({
          key: `link-${tokens.length}`,
          node: (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-muted-foreground/40 underline-offset-2 transition-colors hover:text-primary hover:decoration-primary"
            >
              {renderInlineMarkdown(label)}
            </a>
          ),
        });
        index = closeParen + 1;
        continue;
      }
    }

    const doubleMarker = text.startsWith('**', index) ? '**' : text.startsWith('__', index) ? '__' : null;
    if (doubleMarker) {
      const end = text.indexOf(doubleMarker, index + 2);
      if (end > index + 2) {
        flushBuffer();
        tokens.push({
          key: `strong-${tokens.length}`,
          node: <strong className="font-semibold text-foreground">{renderInlineMarkdown(text.slice(index + 2, end))}</strong>,
        });
        index = end + 2;
        continue;
      }
    }

    const singleMarker = char === '*' ? '*' : char === '_' ? '_' : null;
    if (singleMarker && text[index + 1] && !/\s/.test(text[index + 1])) {
      const end = text.indexOf(singleMarker, index + 1);
      if (end > index + 1) {
        flushBuffer();
        tokens.push({
          key: `em-${tokens.length}`,
          node: <em className="italic text-foreground">{renderInlineMarkdown(text.slice(index + 1, end))}</em>,
        });
        index = end + 1;
        continue;
      }
    }

    buffer += char;
    index += 1;
  }

  flushBuffer();
  return tokens.map((token) => <Fragment key={token.key}>{token.node}</Fragment>);
}

function renderParagraph(text: string, key: string) {
  const trimmed = text.trim();
  const headingMatch = trimmed.match(/^\*\*(.+)\*\*$/);

  if (headingMatch && headingMatch[1]) {
    return (
      <p key={key} className="text-lg font-semibold leading-snug text-foreground">
        {renderInlineMarkdown(headingMatch[1])}
      </p>
    );
  }

  return (
    <p key={key} className="whitespace-pre-wrap leading-7 text-foreground">
      {renderInlineMarkdown(text)}
    </p>
  );
}

function renderMarkdownBlocks(content: string): ReactNode[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const currentLine = lines[index] ?? '';
    const trimmed = currentLine.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index] ?? '');
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }

      blocks.push(
        <pre
          key={`codeblock-${blocks.length}`}
          data-language={language || undefined}
          className="overflow-x-auto rounded-xl border border-border/70 bg-muted/60 p-4 font-mono text-sm leading-6 text-foreground"
        >
          <code className="block whitespace-pre">
            {codeLines.join('\n')}
          </code>
        </pre>,
      );
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2] ?? '';
      const headingClassName = cn(
        'font-semibold leading-snug text-foreground',
        level <= 2 ? 'text-xl' : 'text-lg',
      );
      const renderedHeading = renderInlineMarkdown(text);

      if (level === 1) {
        blocks.push(
          <h2 key={`heading-${blocks.length}`} className={headingClassName}>
            {renderedHeading}
          </h2>,
        );
      } else if (level === 2) {
        blocks.push(
          <h3 key={`heading-${blocks.length}`} className={headingClassName}>
            {renderedHeading}
          </h3>,
        );
      } else if (level === 3) {
        blocks.push(
          <h4 key={`heading-${blocks.length}`} className={headingClassName}>
            {renderedHeading}
          </h4>,
        );
      } else if (level === 4) {
        blocks.push(
          <h5 key={`heading-${blocks.length}`} className={headingClassName}>
            {renderedHeading}
          </h5>,
        );
      } else {
        blocks.push(
          <h6 key={`heading-${blocks.length}`} className={headingClassName}>
            {renderedHeading}
          </h6>,
        );
      }
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
      blocks.push(<hr key={`hr-${blocks.length}`} className="border-border/70" />);
      index += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const quoteLine = lines[index] ?? '';
        if (!/^>\s?/.test(quoteLine.trim())) {
          break;
        }
        quoteLines.push(quoteLine.trim().replace(/^>\s?/, ''));
        index += 1;
      }

      blocks.push(
        <blockquote
          key={`quote-${blocks.length}`}
          className="border-l-2 border-primary/30 pl-4 text-muted-foreground"
        >
          <div className="space-y-2">{quoteLines.map((line, quoteIndex) => renderParagraph(line, `quote-${blocks.length}-${quoteIndex}`))}</div>
        </blockquote>,
      );
      continue;
    }

    const listMatch = trimmed.match(/^((?:[-*+])|(?:\d+\.))\s+(.*)$/);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[1]);
      const items: string[] = [];

      while (index < lines.length) {
        const listLine = lines[index] ?? '';
        const listTrimmed = listLine.trim();
        const nextMatch = listTrimmed.match(/^((?:[-*+])|(?:\d+\.))\s+(.*)$/);
        if (nextMatch) {
          items.push(nextMatch[2] ?? '');
          index += 1;
          continue;
        }

        if (listLine.startsWith('  ') || listLine.startsWith('\t')) {
          if (items.length > 0) {
            items[items.length - 1] = `${items[items.length - 1]} ${listTrimmed}`;
            index += 1;
            continue;
          }
        }

        break;
      }

      const ListTag = ordered ? 'ol' : 'ul';
      blocks.push(
        <ListTag
          key={`list-${blocks.length}`}
          className={cn(
            'space-y-2 pl-6 leading-7 text-foreground',
            ordered ? 'list-decimal' : 'list-disc',
          )}
        >
          {items.map((item, itemIndex) => (
            <li key={`list-${blocks.length}-${itemIndex}`} className="pl-1">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ListTag>,
      );
      continue;
    }

    const paragraphLines: string[] = [trimmed];
    index += 1;
    while (index < lines.length) {
      const nextLine = lines[index] ?? '';
      if (!nextLine.trim() || isSpecialBlockStart(nextLine)) {
        break;
      }
      paragraphLines.push(nextLine.trim());
      index += 1;
    }

    blocks.push(renderParagraph(paragraphLines.join(' '), `paragraph-${blocks.length}`));
  }

  return blocks;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return <div className={cn('space-y-3', className)}>{renderMarkdownBlocks(content)}</div>;
}
