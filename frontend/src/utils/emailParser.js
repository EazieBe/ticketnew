/**
 * Parse .eml (MIME) and .msg (Outlook) files to extract email metadata for ticket creation.
 *
 * Extracts: site_id, inc_number, so_number, date_scheduled, notes
 * e.g. "The tech will be onsite Feb 18th" -> date_scheduled; "Site 1234" -> site_id
 *
 * NOTE: Dragging directly from Outlook to a browser usually does NOT work - Outlook doesn't
 * expose the email as a file. Users should: Save the email as .msg/.eml (File -> Save As,
 * or drag to a folder), then drag that file onto the ticket form.
 */

import { MSGReader } from 'wl-msg-reader';
import dayjs from 'dayjs';

/** Parse .eml (plain text MIME) file */
export async function parseEml(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/);
  const headers = {};
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') {
      bodyStart = i + 1;
      break;
    }
    const m = line.match(/^([^:]+):\s*(.*)$/);
    if (m) {
      const key = m[1].toLowerCase().trim();
      let val = m[2].trim();
      while (i + 1 < lines.length && /^\s/.test(lines[i + 1])) {
        val += ' ' + lines[++i].trim();
      }
      headers[key] = val;
    }
  }
  const body = lines.slice(bodyStart).join('\n').trim();
  const subject = headers.subject || '';
  const from = headers.from || '';
  const date = headers.date || '';
  return { subject, from, date, body };
}

/** Parse .msg (Outlook) file */
export async function parseMsg(file) {
  const buf = await file.arrayBuffer();
  const reader = new MSGReader(buf);
  const data = reader.getFileData();
  if (data.error) {
    throw new Error(data.error);
  }
  const from = data.senderEmail ? (data.senderName ? `${data.senderName} <${data.senderEmail}>` : data.senderEmail) : '';
  return {
    subject: data.subject || '',
    from,
    date: '',
    body: data.body || ''
  };
}

/** Parse email file (.eml or .msg), returns { subject, from, date, body } */
export async function parseEmailFile(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.eml')) {
    return parseEml(file);
  }
  if (name.endsWith('.msg')) {
    return parseMsg(file);
  }
  throw new Error('Unsupported format. Use .eml or .msg file.');
}

/** Extract INC/SO-like refs from text (e.g. INC12345, SO-67890) */
function extractRefs(text) {
  const incMatch = text.match(/\bINC[:\s-]?(\d{4,})\b/i) || text.match(/\b(\d{4,})\s*\(?INC\)?/i);
  const soMatch = text.match(/\bSO[:\s#-]?(\d+)\b/i) || text.match(/\b(\d+)\s*\(?SO\)?/i);
  return {
    inc: incMatch ? (incMatch[1] || incMatch[0].replace(/\D/g, '')).slice(-8) : null,
    so: soMatch ? (soMatch[1] || soMatch[0].replace(/\D/g, '')) : null
  };
}

/** Extract site ID (number) from text. Site list uses numeric IDs.
 * Matches: "Site 2170", "cheddars 2170", "longhorn steakhouse 5256", "OG1232" -> 2170, 5256, 1232 */
function extractSiteId(text) {
  const patterns = [
    /\bsite[:\s#]*(\d{3,5})\b/i,
    /\bsite\s+number[:\s#]*(\d+)/i,
    /\blocation[:\s#]*(\d{3,5})\b/i,
    /\bstore[:\s#]*(\d{3,5})\b/i,
    /\bsite\s+id[:\s#]*(\d+)/i,
    // Store name followed by number: "cheddars 2170", "longhorn steakhouse 5256"
    /\b\w{3,}(?:\s+\w+)*\s+(\d{3,5})\b/i,
    // Brand+number concatenated: "OG1232" -> extract 1232
    /\b[A-Za-z]+(\d{3,5})\b/
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1];
  }
  return null;
}

/** Extract scheduled date from phrases like "onsite Feb 18th", "will be onsite Feb 18", "scheduled for Feb 18" */
function extractScheduledDate(text) {
  const MONTHS = 'jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,dec';
  const year = dayjs().year();

  const tryParse = (monthStr, day, y) => {
    const monthIdx = MONTHS.split(',').findIndex(m => monthStr.toLowerCase().startsWith(m));
    if (monthIdx >= 0 && day >= 1 && day <= 31) {
      const parsed = dayjs(new Date(y, monthIdx, day));
      if (parsed.isValid()) return parsed.format('YYYY-MM-DD');
    }
    return null;
  };

  const onsiteMatch = text.match(/(?:onsite|scheduled(?:\s+for)?)\s+(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?/i);
  if (onsiteMatch) {
    const r = tryParse(onsiteMatch[1], parseInt(onsiteMatch[2], 10), onsiteMatch[3] ? parseInt(onsiteMatch[3], 10) : year);
    if (r) return r;
  }

  const shortMatch = text.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?/i);
  if (shortMatch) {
    const r = tryParse(shortMatch[1], parseInt(shortMatch[2], 10), shortMatch[3] ? parseInt(shortMatch[3], 10) : year);
    if (r) return r;
  }

  const slashMatch = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slashMatch) {
    const m = parseInt(slashMatch[1], 10);
    const d = parseInt(slashMatch[2], 10);
    const y = slashMatch[3] ? parseInt(slashMatch[3], 10) : year;
    const fullYear = (y < 100) ? 2000 + y : y;
    const parsed = dayjs(new Date(fullYear, m - 1, d));
    if (parsed.isValid()) return parsed.format('YYYY-MM-DD');
  }
  return null;
}

/** Build ticket fields from parsed email */
export function emailToTicketFields(parsed) {
  const { subject, from, date, body } = parsed;
  const fullText = [subject, body].join(' ');
  const refs = extractRefs(fullText);
  const site_id = extractSiteId(fullText);
  const date_scheduled = extractScheduledDate(fullText);

  let notes = '';
  if (subject) notes += `Subject: ${subject}\n`;
  if (from) notes += `From: ${from}\n`;
  if (date) notes += `Date: ${date}\n`;
  if (body) notes += `\n${body}`;
  notes = notes.trim();

  return {
    notes,
    site_id: site_id || '',
    inc_number: refs.inc || '',
    so_number: refs.so || '',
    date_scheduled: date_scheduled || ''
  };
}
