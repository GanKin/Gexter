export type MarkdownTableAlignment = 'left' | 'center' | 'right';

export type ParsedMarkdownTable = {
  headers: string[];
  rows: string[][];
  alignments: MarkdownTableAlignment[];
};

function isEscaped(text: string, index: number): boolean {
  let backslashCount = 0;
  for (let i = index - 1; i >= 0 && text[i] === '\\'; i -= 1) {
    backslashCount += 1;
  }
  return backslashCount % 2 === 1;
}

function splitMarkdownTableCells(rowText: string): string[] {
  const text = rowText.trim();
  const cells: string[] = [];
  let current = '';
  let inCodeSpan = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '`' && !isEscaped(text, i)) {
      inCodeSpan = !inCodeSpan;
      current += char;
      continue;
    }

    if (char === '|' && !inCodeSpan && !isEscaped(text, i)) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());

  if (text.startsWith('|') && cells[0] === '') {
    cells.shift();
  }
  if (text.endsWith('|') && cells[cells.length - 1] === '') {
    cells.pop();
  }

  return cells;
}

function isAlignmentCell(cell: string): boolean {
  return /^:?-{3,}:?$/.test(cell.trim());
}

function unescapeMarkdownTableCell(value: string): string {
  return value.replace(/\\([|\\`*_{}\[\]()#+\-.!>])/g, '$1');
}

export function isMarkdownTableSeparatorLine(line: string): boolean {
  const cells = splitMarkdownTableCells(line);
  return cells.length >= 2 && cells.every(isAlignmentCell);
}

export function parseMarkdownTable(tableText: string): ParsedMarkdownTable | null {
  const lines = tableText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.trim().length > 0);

  if (lines.length < 2) return null;

  const headerLine = lines[0];
  if (!headerLine.includes('|')) return null;

  const headers = splitMarkdownTableCells(headerLine).map(unescapeMarkdownTableCell);
  if (headers.length === 0) {
    return null;
  }

  const separatorLine = lines[1] ?? '';
  if (!isMarkdownTableSeparatorLine(separatorLine)) return null;

  const separatorCells = splitMarkdownTableCells(separatorLine);
  const columnCount = Math.max(headers.length, separatorCells.length);
  const normalizedHeaders = [...headers];
  while (normalizedHeaders.length < columnCount) {
    normalizedHeaders.push('');
  }

  const alignments: MarkdownTableAlignment[] = [];
  for (let i = 0; i < columnCount; i += 1) {
    const separatorCell = separatorCells[i] ?? '---';
    if (/^:-{3,}:$/.test(separatorCell)) {
      alignments.push('center');
    } else if (/^-{3,}:$/.test(separatorCell)) {
      alignments.push('right');
    } else {
      alignments.push('left');
    }
  }

  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('|')) {
      break;
    }

    const cells = splitMarkdownTableCells(line).map(unescapeMarkdownTableCell);
    if (cells.length === 0) {
      continue;
    }

    while (cells.length < columnCount) {
      cells.push('');
    }
    rows.push(cells.slice(0, columnCount));
  }

  return { headers: normalizedHeaders, rows, alignments };
}
