/**
 * Markdown table parsing and box-drawing rendering utilities.
 * 
 * Converts markdown tables to properly-aligned Unicode box-drawing tables.
 * Also handles bold text formatting.
 */

import chalk from 'chalk';
import {
  isMarkdownTableSeparatorLine,
  parseMarkdownTable,
  type MarkdownTableAlignment,
} from './markdown-table-core.js';

// Box-drawing characters
const BOX = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  topT: '┬',
  bottomT: '┴',
  leftT: '├',
  rightT: '┤',
  cross: '┼',
};

export type { MarkdownTableAlignment, ParsedMarkdownTable } from './markdown-table-core.js';
export { isMarkdownTableSeparatorLine, parseMarkdownTable } from './markdown-table-core.js';

/**
 * Check if a string looks like a number (for right-alignment).
 */
function isNumeric(value: string): boolean {
  const trimmed = value.trim();
  // Match numbers with optional $, %, B/M/K suffixes
  return /^[$]?[-+]?[\d,]+\.?\d*[%BMK]?$/.test(trimmed);
}

/**
 * Render a parsed table as a Unicode box-drawing table.
 */
export function renderBoxTable(
  headers: string[],
  rows: string[][],
  alignments: MarkdownTableAlignment[] = [],
): string {
  // Calculate column widths
  const colWidths: number[] = headers.map(h => h.length);
  
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      if (i < colWidths.length) {
        colWidths[i] = Math.max(colWidths[i], row[i].length);
      }
    }
  }
  
  // Determine alignment for each column.
  const align: MarkdownTableAlignment[] = headers.map((_, colIndex) => {
    const explicit = alignments[colIndex];
    if (explicit) {
      return explicit;
    }

    // Fallback: right-align mostly numeric columns.
    let numericCount = 0;
    for (const row of rows) {
      if (row[colIndex] && isNumeric(row[colIndex])) {
        numericCount += 1;
      }
    }
    return numericCount > rows.length / 2 ? 'right' : 'left';
  });
  
  // Helper to pad a cell
  const padCell = (value: string, width: number, alignment: MarkdownTableAlignment): string => {
    if (alignment === 'right') {
      return value.padStart(width);
    }
    if (alignment === 'center') {
      const totalPadding = Math.max(width - value.length, 0);
      const leftPadding = Math.floor(totalPadding / 2);
      const rightPadding = totalPadding - leftPadding;
      return `${' '.repeat(leftPadding)}${value}${' '.repeat(rightPadding)}`;
    }
    return value.padEnd(width);
  };
  
  // Build the table
  const lines: string[] = [];
  
  // Top border
  const topBorder = BOX.topLeft + 
    colWidths.map(w => BOX.horizontal.repeat(w + 2)).join(BOX.topT) + 
    BOX.topRight;
  lines.push(topBorder);
  
  // Header row
  const headerRow = BOX.vertical + 
    headers.map((h, i) => ` ${padCell(h, colWidths[i], align[i] ?? 'left')} `).join(BOX.vertical) + 
    BOX.vertical;
  lines.push(headerRow);
  
  // Header separator
  const headerSep = BOX.leftT + 
    colWidths.map(w => BOX.horizontal.repeat(w + 2)).join(BOX.cross) + 
    BOX.rightT;
  lines.push(headerSep);
  
  // Data rows
  for (const row of rows) {
    const dataRow = BOX.vertical + 
      colWidths.map((w, i) => {
        const value = row[i] || '';
        return ` ${padCell(value, w, align[i] ?? 'left')} `;
      }).join(BOX.vertical) + 
      BOX.vertical;
    lines.push(dataRow);
  }
  
  // Bottom border
  const bottomBorder = BOX.bottomLeft + 
    colWidths.map(w => BOX.horizontal.repeat(w + 2)).join(BOX.bottomT) + 
    BOX.bottomRight;
  lines.push(bottomBorder);
  
  return lines.join('\n');
}

/**
 * Find and transform all markdown tables in content to box-drawing tables.
 */
export function transformMarkdownTables(content: string): string {
  // Normalize line endings: convert \r\n to \n, then trim trailing whitespace from each line
  const normalized = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n');

  const lines = normalized.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const nextLine = lines[i + 1] ?? '';

    if (line.includes('|') && isMarkdownTableSeparatorLine(nextLine)) {
      const tableLines = [line, nextLine];
      i += 2;

      while (i < lines.length) {
        const candidate = lines[i] ?? '';
        if (!candidate.trim() || !candidate.includes('|')) {
          i -= 1;
          break;
        }
        tableLines.push(candidate);
        i += 1;
      }

      const parsed = parseMarkdownTable(tableLines.join('\n'));
      if (parsed && parsed.headers.length > 0) {
        result.push(renderBoxTable(parsed.headers, parsed.rows, parsed.alignments));
      } else {
        result.push(...tableLines);
      }
      continue;
    }

    result.push(line);
  }

  return result.join('\n');
}

/**
 * Transform markdown bold (**text**) to ANSI bold.
 */
export function transformBold(content: string): string {
  return content.replace(/\*\*([^*]+)\*\*/g, (_, text) => chalk.bold(text));
}

/**
 * Apply all pre-render formatting to response content.
 * - Converts markdown tables to unicode box-drawing tables
 * - Converts **bold** to ANSI bold
 */
export function formatResponse(content: string): string {
  let result = content;
  result = transformMarkdownTables(result);
  result = transformBold(result);
  return result;
}
