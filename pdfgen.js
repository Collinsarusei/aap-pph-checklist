'use strict';
// Built-in PDF writer: draws the completed checklist straight to PDF with no
// browser or third-party library. Uses the standard Helvetica fonts that every
// PDF reader ships, so nothing is embedded.
const { FORM } = require('./form');

const A4 = { w: 595.28, h: 841.89 };
const M = { l: 44, r: 44, t: 46, b: 48 };
const CONTENT_W = A4.w - M.l - M.r;

// Glyph widths (per 1000 em) for Helvetica and Helvetica-Bold, chars 32..126.
const W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

function textWidth(s, bold, size) {
  const t = bold ? W_BOLD : W_REG;
  let w = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    w += c >= 32 && c <= 126 ? t[c - 32] : 556;
  }
  return (w * size) / 1000;
}

// WinAnsi-ish encoding as a PDF hex string; characters outside Latin-1 become '?'.
function hex(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c === 0x2019) c = 0x92; // right single quote
    else if (c === 0x2018) c = 0x91;
    else if (c === 0x201c) c = 0x93;
    else if (c === 0x201d) c = 0x94;
    else if (c === 0x2013) c = 0x96;
    else if (c === 0x2014) c = 0x97;
    else if (c === 0x2022) c = 0x95;
    else if (c > 255) c = 63;
    out += c.toString(16).padStart(2, '0');
  }
  return out;
}

// "<b>bold</b> normal" -> [{t, b}]
function segments(str) {
  const out = [];
  const re = /<b>([\s\S]*?)<\/b>/g;
  let last = 0; let m;
  while ((m = re.exec(str))) {
    if (m.index > last) out.push({ t: str.slice(last, m.index), b: false });
    out.push({ t: m[1], b: true });
    last = m.index + m[0].length;
  }
  if (last < str.length) out.push({ t: str.slice(last), b: false });
  return out.map((s) => ({ t: s.t.replace(/<[^>]+>/g, ''), b: s.b }));
}

// Split segments into word tokens, then into lines that fit maxW.
function wrapSegments(segs, maxW, size) {
  const tokens = [];
  for (const s of segs) {
    const parts = s.t.split(/(\s+|\n)/);
    for (const p of parts) {
      if (p === '') continue;
      if (p === '\n') tokens.push({ nl: true });
      else if (/^\s+$/.test(p)) tokens.push({ t: ' ', b: s.b, space: true });
      else tokens.push({ t: p, b: s.b });
    }
  }
  const lines = [[]]; let lw = 0;
  for (const tk of tokens) {
    if (tk.nl) { lines.push([]); lw = 0; continue; }
    const w = textWidth(tk.t, tk.b, size);
    if (tk.space) { if (lw > 0) { lines[lines.length - 1].push(tk); lw += w; } continue; }
    if (lw + w > maxW && lw > 0) { lines.push([]); lw = 0; }
    // Hard-split words wider than the column.
    if (w > maxW) {
      let chunk = '';
      for (const ch of tk.t) {
        if (textWidth(chunk + ch, tk.b, size) > maxW && chunk) { lines[lines.length - 1].push({ t: chunk, b: tk.b }); lines.push([]); chunk = ''; }
        chunk += ch;
      }
      lines[lines.length - 1].push({ t: chunk, b: tk.b }); lw = textWidth(chunk, tk.b, size);
      continue;
    }
    lines[lines.length - 1].push(tk); lw += w;
  }
  return lines.map((l) => { while (l.length && l[l.length - 1].space) l.pop(); return l; });
}

class Doc {
  constructor() { this.pages = []; this.newPage(); }
  newPage() { this.ops = []; this.pages.push(this.ops); this.y = A4.h - M.t; }
  ensure(h) { if (this.y - h < M.b) this.newPage(); }
  op(s) { this.ops.push(s); }
  textAt(x, y, s, bold, size) { this.op(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td <${hex(s)}> Tj ET`); }
  rect(x, y, w, h, fill) { this.op(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${fill ? 'f' : 'S'}`); }
  hline(x1, x2, y) { this.op(`${x1.toFixed(2)} ${y.toFixed(2)} m ${x2.toFixed(2)} ${y.toFixed(2)} l S`); }
  box(x, y, on) { this.rect(x, y, 7.5, 7.5, false); if (on) this.rect(x + 1.5, y + 1.5, 4.5, 4.5, true); }

  // Draw one wrapped line of tokens with baseline at y; returns end x.
  drawLine(x, y, line, size) {
    for (const tk of line) { this.textAt(x, y, tk.t, tk.b, size); x += textWidth(tk.t, tk.b, size); }
    return x;
  }

  paragraph(str, { size = 9.5, bold = false, x = M.l, w = CONTENT_W, gap = 4, indent = 0 } = {}) {
    const segs = typeof str === 'string' ? (bold ? [{ t: str, b: true }] : segments(str)) : str;
    const lineH = size * 1.28;
    const lines = wrapSegments(segs, w - indent, size);
    for (let i = 0; i < lines.length; i++) {
      this.ensure(lineH);
      this.drawLine(x + (i === 0 ? 0 : indent), this.y - size, lines[i], size);
      this.y -= lineH;
    }
    this.y -= gap;
  }

  heading(str, size = 10.5, gapTop = 6) {
    this.y -= gapTop;
    this.ensure(size * 2.5);
    this.textAt(M.l, this.y - size, str, true, size);
    this.y -= size * 1.5;
  }

  // label: value on one line, with the value underlined like the paper form.
  field(label, value, { size = 9.5, labelW = 150, unit = '' } = {}) {
    const lineH = size * 1.6;
    this.ensure(lineH);
    this.textAt(M.l, this.y - size, label + ':', true, size);
    labelW = Math.max(labelW, textWidth(label + ':', true, size) + 8);
    const x = M.l + labelW; const vw = Math.min(CONTENT_W - labelW - (unit ? 30 : 0), 300);
    this.textAt(x + 3, this.y - size, String(value ?? ''), false, size);
    this.hline(x, x + vw, this.y - size - 2);
    if (unit) this.textAt(x + vw + 4, this.y - size, unit, false, size);
    this.y -= lineH;
  }

  // label: [x] Yes [ ] No ...
  optionField(label, options, cur, { size = 9.5, labelW = 150, extra = '' } = {}) {
    const lineH = size * 1.6;
    this.ensure(lineH);
    this.textAt(M.l, this.y - size, label + ':', true, size);
    let x = M.l + Math.max(labelW, textWidth(label + ':', true, size) + 8);
    x = this.optionsInline(x, this.y - size, options, cur, size);
    if (extra) { this.textAt(x + 6, this.y - size, extra, false, size); this.hline(x + 4, Math.min(x + 4 + textWidth(extra, false, size) + 20, A4.w - M.r), this.y - size - 2); }
    this.y -= lineH;
  }
  optionsInline(x, baseline, options, cur, size) {
    for (const o of options) {
      this.box(x, baseline - 1, cur === o);
      x += 10;
      this.textAt(x, baseline, o, false, size);
      x += textWidth(o, false, size) + 10;
    }
    return x;
  }

  // Multi-line boxed text area.
  textBlock(label, value, { size = 9.5, minH = 28 } = {}) {
    this.ensure(size * 1.5 + minH);
    this.textAt(M.l, this.y - size, label + ':', true, size);
    this.y -= size * 1.5;
    const lineH = size * 1.28;
    const lines = wrapSegments([{ t: String(value ?? ''), b: false }], CONTENT_W - 8, size);
    const h = Math.max(minH, lines.length * lineH + 6);
    this.ensure(h);
    this.rect(M.l, this.y - h, CONTENT_W, h, false);
    let y = this.y - 3;
    for (const l of lines) { this.drawLine(M.l + 4, y - size, l, size); y -= lineH; }
    this.y -= h + 6;
  }

  // cols: [{w, h: headerText, align}]  rows: arrays of cells.
  // cell: string | {opts, val} (inline options) | {box: on} (single centred box) | {b: boldString}
  table(cols, rows, { size = 9 } = {}) {
    const lineH = size * 1.25; const pad = 2.5;
    const cellLines = (cell, w) => {
      if (cell && typeof cell === 'object' && 'box' in cell) return 1;
      if (cell && typeof cell === 'object' && cell.opts) return 1;
      const str = cell && typeof cell === 'object' && cell.b != null ? [{ t: cell.b, b: true }] : [{ t: String(cell ?? ''), b: false }];
      return wrapSegments(str, w - 2 * pad, size).length;
    };
    const drawHeader = () => {
      const h = lineH + 2 * pad;
      this.ensure(h + lineH * 2);
      let x = M.l;
      for (const c of cols) {
        this.rect(x, this.y - h, c.w, h, false);
        const tw = textWidth(c.h, true, size);
        this.textAt(c.align === 'c' ? x + (c.w - tw) / 2 : x + pad, this.y - pad - size + 1, c.h, true, size);
        x += c.w;
      }
      this.y -= h;
    };
    drawHeader();
    for (const row of rows) {
      const n = Math.max(...row.map((cell, i) => cellLines(cell, cols[i].w)));
      const h = n * lineH + 2 * pad;
      if (this.y - h < M.b) { this.newPage(); drawHeader(); }
      let x = M.l;
      row.forEach((cell, i) => {
        const c = cols[i];
        this.rect(x, this.y - h, c.w, h, false);
        const base = this.y - pad - size + 1;
        if (cell && typeof cell === 'object' && 'box' in cell) this.box(x + (c.w - 7.5) / 2, base - 1, cell.box);
        else if (cell && typeof cell === 'object' && cell.opts) this.optionsInline(x + pad, base, cell.opts, cell.val, size);
        else {
          const segs = cell && typeof cell === 'object' && cell.b != null ? [{ t: cell.b, b: true }] : [{ t: String(cell ?? ''), b: false }];
          const lines = wrapSegments(segs, c.w - 2 * pad, size);
          let y = base;
          for (const l of lines) { this.drawLine(x + pad, y, l, size); y -= lineH; }
        }
        x += c.w;
      });
      this.y -= h;
    }
    this.y -= 6;
  }

  bullets(items, size = 9.5) {
    for (const it of items) this.paragraph([{ t: '•  ', b: false }, ...segments(it)], { size, indent: 10, gap: 1 });
    this.y -= 3;
  }

  // Serialise to a PDF buffer, adding a footer to each page.
  build(footer) {
    const objs = [];
    const add = (s) => { objs.push(s); return objs.length; };
    const catalog = add(null); const pagesObj = add(null);
    const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const pageIds = [];
    this.pages.forEach((ops, i) => {
      const foot = `BT /F1 8 Tf ${M.l} ${(M.b - 18).toFixed(2)} Td <${hex(`${footer}   Page ${i + 1} of ${this.pages.length}`)}> Tj ET`;
      const content = `0.6 w 0 G 0 g\n${ops.join('\n')}\n${foot}`;
      const cid = add(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);
      const pid = add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${cid} 0 R >>`);
      pageIds.push(pid);
    });
    objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
    objs[pagesObj - 1] = `<< /Type /Pages /Kids [${pageIds.map((p) => `${p} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

    let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets = [];
    objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = Buffer.byteLength(out, 'latin1');
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(out, 'latin1');
  }
}

const fmtDT = (s) => {
  if (!s) return '';
  if (s instanceof Date) { const p = (n) => String(n).padStart(2, '0'); return `${s.getFullYear()}-${p(s.getMonth() + 1)}-${p(s.getDate())} ${p(s.getHours())}:${p(s.getMinutes())}`; }
  return String(s).replace('T', ' ').slice(0, 16);
};
const formNo = (id) => FORM.formNo + String(id).padStart(6, '0');

// d: answers, m: { hospitalName, department, recordId, staffName, savedAt }
function renderRecordPdf(d, m) {
  const doc = new Doc();
  doc.heading(FORM.title, 11.5, 0);
  doc.field('Hospital', m.hospitalName);
  doc.field('Department', `${m.department} Services`);
  doc.field('Form No.', formNo(m.recordId));
  for (const f of FORM.header) doc.field(f.label, f.type === 'datetime' ? fmtDT(d[f.id]) : d[f.id]);

  for (const s of FORM.sections) {
    doc.heading(s.title);
    if (s.note) doc.paragraph(s.note);
    for (const g of s.groups || []) {
      doc.y -= 2;
      doc.ensure(64); // keep a group heading together with the first rows of its table
      if (g.heading) doc.paragraph(g.heading, { bold: true, size: 9.5, gap: 2 });
      if (g.findings) {
        doc.table([{ w: 300, h: 'Assessment item' }, { w: CONTENT_W - 300, h: 'Findings' }],
          g.items.map(([id, label, opts]) => [label, { opts, val: d[id] }]));
      } else {
        if (g.instruction) doc.paragraph(g.instruction, { gap: 2 });
        const optW = 52;
        const cols = [{ w: 28, h: 'No.', align: 'c' }, { w: CONTENT_W - 28 - optW * g.columns.length, h: g.col }, ...g.columns.map((c) => ({ w: optW, h: c, align: 'c' }))];
        doc.table(cols, g.items.map(([id, label], i) => [String(i + 1), label, ...g.columns.map((c) => ({ box: d[id] === c }))]));
      }
    }
    if (s.classification) {
      doc.table([{ w: 80, h: 'Risk category' }, { w: (CONTENT_W - 80) / 2, h: 'Suggested criteria' }, { w: (CONTENT_W - 80) / 2, h: 'Required action' }],
        s.classification.map(([c, a, b]) => [{ b: c }, a, b]));
    }
    for (const f of s.fields || []) {
      if (f.type === 'choice') doc.optionField(f.label, f.options, d[f.id], { labelW: 190, extra: f.other ? d[f.other] : '' });
      else if (f.type === 'textarea') doc.textBlock(f.label, d[f.id]);
      else doc.field(f.label, f.type === 'datetime' ? fmtDT(d[f.id]) : d[f.id], { labelW: 190, unit: f.unit || '' });
    }
    if (s.footnote) {
      doc.y -= 2;
      if (s.footnote.title) doc.paragraph(s.footnote.title, { bold: true, gap: 2 });
      if (s.footnote.text) doc.paragraph(s.footnote.text);
      if (s.footnote.bullets) doc.bullets(s.footnote.bullets);
    }
  }

  doc.y -= 8; doc.ensure(50);
  doc.hline(M.l, A4.w - M.r, doc.y); doc.y -= 6;
  doc.paragraph([
    { t: 'Completed electronically by: ', b: true },
    { t: `${m.staffName} (${m.department}) on ${fmtDT(m.savedAt)}. Record ${formNo(m.recordId)} stored in the ${m.hospitalName} electronic forms system. No handwritten signature required.`, b: false },
  ], { size: 8.5 });

  return doc.build(`${formNo(m.recordId)}  |  ${d.patient_name || ''}  |  Hospital No. ${d.hospital_no || ''}  |  ${m.hospitalName}`);
}

module.exports = { renderRecordPdf };
