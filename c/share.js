var module = { exports: {} };
/**
 * shareLink.js - a whole collection inside one link.
 *
 *   https://holofolio.co.uk/c/#v1/<title>/<payload>
 *
 * Everything after '#' stays in the browser: it is never sent to any server,
 * GitHub's included. So the link IS the collection, nothing is stored
 * anywhere, and only people it is given to can see it.
 *
 * PAYLOAD: sets joined by '~', each "<setId>:<entries>", entries by ',':
 *     <number>[.<variant>][*<qty>]
 *   number  the collector number (URI-escaped); the card id is <setId>-<number>
 *   variant one letter, omitted for 'normal':
 *           r reverse · h holo · f firstEdition · F firstEditionHolo
 *           s shadowless · S shadowlessHolo · anything else spelled out
 *   qty     omitted when 1
 * A card whose id is not <setId>-<number> is written as '!<full id>'.
 *
 * Example: "sv8:1,4.r,7*2~base1:4.h" - about 5 characters a card, so 500
 * cards is ~2.5 KB of link, well inside what phones and browsers carry.
 *
 * Pure JavaScript, no imports: the website's viewer uses this same file.
 */

const V2C = { reverse: 'r', holo: 'h', firstEdition: 'f', firstEditionHolo: 'F', shadowless: 's', shadowlessHolo: 'S' };
const C2V = Object.fromEntries(Object.entries(V2C).map(([k, v]) => [v, k]));
const BASE = 'https://holofolio.co.uk/c/';

const esc = (s) => encodeURIComponent(s).replace(/[~,.*!:]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * @param rows  [{ setId, cardId, variant, quantity }]
 * @returns the payload string (no prefix)
 */
function encodeCollection(rows) {
  const bySet = new Map();
  for (const r of rows) {
    if (!r || !r.cardId) continue;
    const setId = r.setId || String(r.cardId).replace(/-[^-]*$/, '');
    if (!bySet.has(setId)) bySet.set(setId, []);
    bySet.get(setId).push(r);
  }
  const parts = [];
  for (const [setId, list] of bySet) {
    const prefix = `${setId}-`;
    const entries = list.map((r) => {
      const id = String(r.cardId);
      let e = id.startsWith(prefix) ? esc(id.slice(prefix.length)) : `!${esc(id)}`;
      const v = r.variant || 'normal';
      if (v !== 'normal') e += `.${V2C[v] || esc(v)}`;
      const q = Math.max(1, parseInt(r.quantity, 10) || 1);
      if (q > 1) e += `*${q}`;
      return e;
    });
    parts.push(`${esc(setId)}:${entries.join(',')}`);
  }
  return parts.join('~');
}

/** @returns [{ setId, cardId, variant, quantity }] */
function decodeCollection(payload) {
  const out = [];
  if (!payload) return out;
  for (const part of String(payload).split('~')) {
    const colon = part.indexOf(':');
    if (colon < 1) continue;
    const setId = decodeURIComponent(part.slice(0, colon));
    for (const raw of part.slice(colon + 1).split(',')) {
      if (!raw) continue;
      let e = raw;
      let quantity = 1;
      const star = e.lastIndexOf('*');
      if (star > 0) { quantity = parseInt(e.slice(star + 1), 10) || 1; e = e.slice(0, star); }
      let variant = 'normal';
      const dot = e.lastIndexOf('.');
      if (dot > 0) {
        const code = decodeURIComponent(e.slice(dot + 1));
        variant = C2V[code] || code;
        e = e.slice(0, dot);
      }
      const cardId = e.startsWith('!') ? decodeURIComponent(e.slice(1)) : `${setId}-${decodeURIComponent(e)}`;
      out.push({ setId, cardId, variant, quantity });
    }
  }
  return out;
}

/** The full link. `title` is optional ("Rafael's binder"). */
function buildShareLink(rows, title = '') {
  return `${BASE}#v1/${esc(title || '')}/${encodeCollection(rows)}`;
}

/**
 * Accepts a link, or just the part after '#', or text containing a link
 * (a share-sheet message). Returns { title, rows } or null.
 */
function parseShareLink(text) {
  if (!text) return null;
  const s = String(text).trim();
  const m = s.match(/#?v1\/([^/\s]*)\/(\S*)/);
  if (!m) return null;
  let title = '';
  try { title = decodeURIComponent(m[1]); } catch (e) { title = ''; }
  const rows = decodeCollection(m[2]);
  return rows.length ? { title, rows } : null;
}

window.HoloShare = { encodeCollection, decodeCollection, buildShareLink, parseShareLink, SHARE_BASE: BASE };
