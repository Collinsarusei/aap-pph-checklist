'use strict';
const { FORM } = require('./form');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDT = (s) => {
  if (!s) return '';
  if (s instanceof Date) { const p = (n) => String(n).padStart(2, '0'); return `${s.getFullYear()}-${p(s.getMonth() + 1)}-${p(s.getDate())} ${p(s.getHours())}:${p(s.getMinutes())}`; }
  return String(s).replace('T', ' ').slice(0, 16);
};
const formNo = (id) => FORM.formNo + String(id).padStart(6, '0');

// ---------------------------------------------------------------- layout
function layout({ title, body, hospitalName, admin = null, extraHead = '' }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · APH/PPH Checklist</title>
<link rel="stylesheet" href="/style.css">${extraHead}</head>
<body>
<header class="topbar">
  <a class="brand" href="/">${esc(hospitalName)} · APH/PPH Risk Assessment</a>
  ${!admin || admin.role === 'viewer' ? `<span class="who"><a class="lock" href="/records"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span>Search patient</span></a><a class="lock" href="/admin" title="Admin sign-in" aria-label="Admin sign-in"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><span>Admin</span></a></span>`
    : `<nav><a href="/admin">Submissions</a><a href="/records">Search patient</a><a href="/" target="_blank">New form</a></nav><span class="who">Admin: ${esc(admin.username)} <form method="post" action="/admin/logout"><button type="submit">Log out</button></form></span>`}
</header>
<main>${body}</main>
</body></html>`;
}

function staffQS(dept, name, desig) {
  return `dept=${encodeURIComponent(dept)}&name=${encodeURIComponent(name)}&desig=${encodeURIComponent(desig)}`;
}
function staffHidden(dept, name, desig) {
  return `<input type="hidden" name="dept" value="${esc(dept)}"><input type="hidden" name="name" value="${esc(name)}"><input type="hidden" name="desig" value="${esc(desig)}">`;
}

// ---------------------------------------------------------------- start page
function startPage({ hospitalName, error, pre = {} }) {
  return layout({ title: 'Start', hospitalName, body: `
  <div class="card start">
    <h1>APH/PPH Risk Assessment Checklist</h1>
    <p class="note">Choose your department and enter your name and designation to begin. Your form is saved in this browser as you type, so you can close the page and continue later.</p>
    ${error ? `<div class="error">${esc(error)}</div>` : ''}
    <div id="draftBox" class="warnbox" hidden>
      <b>You have an unfinished form</b> <span id="draftInfo"></span><br>
      <p id="draftMissing" class="hint" hidden><b>Please type your name and designation below, then press Open the checklist.</b> Your answers will come back.</p>
      <div class="actions" style="margin:8px 0 0">
        <a class="btn" id="draftContinue" href="/form">Continue it</a>
        <button class="btn secondary" id="draftDiscard" type="button">Discard it</button>
        <span id="draftConfirm" hidden>Discard it for good? <button class="btn small danger" id="draftYes" type="button">Yes, discard</button> <button class="btn small secondary" id="draftNo" type="button">Keep it</button></span>
      </div>
    </div>
    <form method="get" action="/form" id="start">
      <label class="req">Department</label>
      <div class="deptpick">
        ${FORM.departments.map((d) => `<label class="deptopt"><input type="radio" name="dept" value="${esc(d)}" required${pre.dept === d ? ' checked' : ''}> <span>${esc(d)}</span></label>`).join('')}
      </div>
      <div class="grid" style="margin-top:14px">
        <div><label class="req" for="name">Your name</label>
          <input id="name" type="text" name="name" value="${esc(pre.name || '')}" placeholder="Example: Mary Njeri" required maxlength="80" autocomplete="off"></div>
        <div><label class="req" for="desig">Designation</label>
          <input id="desig" type="text" name="desig" value="${esc(pre.desig || '')}" placeholder="Example: Nursing Officer" required maxlength="60" autocomplete="off"></div>
      </div>
      <div class="actions"><button class="btn" type="submit">Open the checklist</button></div>
    </form>
    <div class="searchbox">
      <a class="btn secondary" href="/records"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Search patient</a>
      <span class="hint">Find a form that was already filled, by patient name or hospital number, and download its PDF.</span>
    </div>
  </div>
  <script>
  (function () {
    try {
      localStorage.removeItem('aphpph:staff'); // names are never remembered on shared PCs
      var draft = JSON.parse(localStorage.getItem('aphpph:draft') || 'null');
      if (draft && draft.values) {
        var box = document.getElementById('draftBox');
        var who = (draft.values.patient_name || draft.values.hospital_no) ? ' for ' + (draft.values.patient_name || '') + (draft.values.hospital_no ? ' (Hospital No. ' + draft.values.hospital_no + ')' : '') : '';
        // Drafts saved before the designation box existed hold "Name, Designation" in one field.
        var dn = String(draft.name || ''), dd = String(draft.desig || ''), dp = String(draft.dept || '');
        if (!dd && dn.indexOf(',') > 0) { dd = dn.slice(dn.indexOf(',') + 1).trim(); dn = dn.slice(0, dn.indexOf(',')).trim(); }
        document.getElementById('draftInfo').textContent = who + ', saved ' + new Date(draft.savedAt).toLocaleString() + (dn ? ' by ' + dn + (dd ? ', ' + dd : '') : '') + (dp ? ' (' + dp + ')' : '') + '.';
        var cont = document.getElementById('draftContinue'), sf = document.getElementById('start');
        if (dp && dn && dd) {
          cont.href = '/form?dept=' + encodeURIComponent(dp) + '&name=' + encodeURIComponent(dn) + '&desig=' + encodeURIComponent(dd);
        } else {
          cont.href = '#start';
          cont.onclick = function (e) {
            e.preventDefault();
            sf.querySelectorAll('input[name=dept]').forEach(function (r) { if (r.value === dp) r.checked = true; });
            if (dn && !sf.name.value) sf.name.value = dn;
            if (dd && !sf.desig.value) sf.desig.value = dd;
            document.getElementById('draftMissing').hidden = false;
            var empty = !sf.name.value ? sf.name : (!sf.desig.value ? sf.desig : null);
            if (empty) empty.focus(); else sf.requestSubmit();
          };
        }
        var dBtn = document.getElementById('draftDiscard'), dConf = document.getElementById('draftConfirm');
        dBtn.onclick = function () { dBtn.hidden = true; dConf.hidden = false; };
        document.getElementById('draftNo').onclick = function () { dConf.hidden = true; dBtn.hidden = false; };
        document.getElementById('draftYes').onclick = function () { localStorage.removeItem('aphpph:draft'); box.hidden = true; };
        box.hidden = false;
      }
    } catch (e) {}
  })();
  </script>` });
}

// ---------------------------------------------------------------- form widgets
function radio(name, options, cur) {
  return options.map((o) => `<label><input type="radio" name="${esc(name)}" value="${esc(o)}"${cur === o ? ' checked' : ''}> ${esc(o)}</label>`).join('');
}

function inputField(f, v, errors) {
  const val = v[f.id] ?? '';
  const bad = errors[f.id] ? ' invalid' : '';
  const lab = `<label class="${f.required ? 'req' : ''}">${esc(f.label)}${f.unit ? ` <span class="unit">(${esc(f.unit)})</span>` : ''}</label>`;
  let ctl;
  switch (f.type) {
    case 'textarea': ctl = `<textarea name="${f.id}" class="${bad}">${esc(val)}</textarea>`; break;
    case 'number': ctl = `<input type="number" name="${f.id}" value="${esc(val)}" class="${bad}"${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''} step="any">`; break;
    case 'datetime': ctl = `<input type="datetime-local" name="${f.id}" value="${esc(val)}" class="${bad}">`; break;
    case 'choice': ctl = `<div class="inline">${radio(f.id, f.options, val)}${f.other ? `<input type="text" name="${f.other}" value="${esc(v[f.other] ?? '')}" placeholder="Other, specify" style="width:auto;display:inline-block">` : ''}</div>`; break;
    default: ctl = `<input type="text" name="${f.id}" value="${esc(val)}" class="${bad}"${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}>`;
  }
  return `<div>${lab}${ctl}${errors[f.id] ? `<div class="hint" style="color:var(--danger)">${esc(errors[f.id])}</div>` : ''}</div>`;
}

function groupTable(g, v) {
  if (g.findings) {
    return `${g.heading ? `<h3>${esc(g.heading)}</h3>` : ''}<table>
      <thead><tr><th>Assessment item</th><th>Findings</th></tr></thead><tbody>
      ${g.items.map(([id, label, opts]) => `<tr><td>${esc(label)}</td><td class="inline">${radio(id, opts, v[id])}</td></tr>`).join('')}
      </tbody></table>`;
  }
  return `${g.heading ? `<h3>${esc(g.heading)}</h3>` : ''}${g.instruction ? `<p class="note">${esc(g.instruction)}</p>` : ''}<table>
    <thead><tr><th style="width:40px">No.</th><th>${esc(g.col)}</th>${g.columns.map((c) => `<th class="opt">${esc(c)}</th>`).join('')}</tr></thead><tbody>
    ${g.items.map(([id, label], i) => `<tr><td class="num">${i + 1}</td><td>${esc(label)}</td>${g.columns.map((c) => `<td class="opt"><label><input type="radio" name="${id}" value="${esc(c)}"${v[id] === c ? ' checked' : ''}></label></td>`).join('')}</tr>`).join('')}
    </tbody></table>`;
}

function classificationTable(rows) {
  return `<table><thead><tr><th style="width:120px">Risk category</th><th>Suggested criteria</th><th>Required action</th></tr></thead><tbody>
    ${rows.map(([c, crit, act]) => `<tr><td><b>${esc(c)}</b></td><td>${esc(crit)}</td><td>${esc(act)}</td></tr>`).join('')}</tbody></table>`;
}

function footnote(fn) {
  if (!fn) return '';
  return `<div class="warnbox">${fn.title ? `<b>${esc(fn.title)}</b>` : ''}${fn.text ? `<p style="margin:4px 0">${fn.text}</p>` : ''}${fn.bullets ? `<ul style="margin:6px 0 0 18px">${fn.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>` : ''}</div>`;
}

// ---------------------------------------------------------------- the checklist page
function formPage({ dept, name, desig, v, errors, hospitalName, fresh = false, admin = null, recordId = null, staffName = '' }) {
  const isAdmin = !!admin;
  const errList = Object.keys(errors);
  const body = `
  <form method="post" action="${isAdmin ? `/admin/records/${recordId}/edit` : '/preview'}" id="assessment" autocomplete="off">
  ${isAdmin ? '' : staffHidden(dept, name, desig)}
  <div class="card">
    ${isAdmin ? `<h1>Edit ${esc(formNo(recordId))}</h1>
    <p class="note">You are changing a submitted record. <b>Save changes</b> updates it and redraws its PDF. <a href="/admin/records/${recordId}">Cancel</a></p>` : `<h1>APH/PPH risk assessment</h1>
    <p class="note">Filling as <b>${esc(name)}</b>, ${esc(desig)}, <b>${esc(dept)}</b> <a href="/">(change)</a>. Saved automatically in this browser while you type.</p>
    <div id="draftNote" class="success" hidden>Restored your unfinished form (saved <span id="draftWhen"></span>). <button type="button" class="btn small secondary" id="draftClear">Start blank instead</button>
      <span id="clearConfirm" hidden>This throws away the restored answers. <button type="button" class="btn small danger" id="clearYes">Yes, start blank</button> <button type="button" class="btn small secondary" id="clearNo">Keep them</button></span></div>`}
    ${errList.length ? `<div class="error"><b>Please correct the following:</b><ul>${errList.map((k) => `<li>${esc(errors[k])}</li>`).join('')}</ul></div>` : ''}
    <div class="grid">
      <div><label>Hospital</label><input type="text" value="${esc(hospitalName)}" readonly></div>
      ${isAdmin ? `<div><label class="req">Department</label><select name="dept">${FORM.departments.map((d) => `<option${d === dept ? ' selected' : ''}>${esc(d)}</option>`).join('')}</select></div>
      <div><label>Form No.</label><input type="text" value="${esc(formNo(recordId))}" readonly></div>
      <div><label class="req">Completed by (name, designation)</label><input type="text" name="staff" value="${esc(staffName)}" maxlength="150" required${errors.staff ? ' class="invalid"' : ''}></div>` : `<div><label>Department</label><input type="text" value="${esc(dept)}" readonly></div>
      <div><label>Form No.</label><input type="text" value="assigned when saved" readonly></div>`}
      ${FORM.header.map((f) => inputField(f, v, errors)).join('')}
    </div>
  </div>

  ${FORM.sections.map((s) => `
  <div class="card" id="sec${s.id}">
    <h2>${esc(s.title)}</h2>
    ${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}
    ${s.id === 'D' ? `<p class="dhint" id="dHint" hidden><b>Increased/High risk selected in Section F</b> – please complete this checklist.</p>` : ''}
    ${(s.groups || []).map((g) => groupTable(g, v)).join('')}
    ${s.classification ? classificationTable(s.classification) : ''}
    ${s.fields ? `<div class="grid">${s.fields.map((f) => inputField(f, v, errors)).join('')}</div>` : ''}
    ${footnote(s.footnote)}
  </div>`).join('')}

  <div class="card sticky-save">
    <div class="actions">
      ${isAdmin ? `<button class="btn" type="submit">Save changes</button>
      <a class="btn secondary" href="/admin/records/${recordId}">Cancel</a>` : `<button class="btn" type="submit">Preview</button>
      <span class="muted">You will see the completed form before saving it.</span>`}
    </div>
  </div>
  </form>
  <script>
  (function () {
    var form = document.getElementById('assessment');
    var KEY = 'aphpph:draft';
    var STAFF = ${JSON.stringify(!isAdmin)}; // admin edits never touch the browser draft
    function collect() {
      var o = {}; var fd = new FormData(form);
      fd.forEach(function (val, k) { if (k !== 'dept' && k !== 'name' && k !== 'desig') o[k] = val; });
      return o;
    }
    function save() {
      if (!STAFF) return;
      try { localStorage.setItem(KEY, JSON.stringify({ dept: form.dept.value, name: form.name.value, desig: form.desig.value, savedAt: Date.now(), values: collect() })); } catch (e) {}
    }
    function restore(values) {
      Object.keys(values).forEach(function (k) {
        var els = form.querySelectorAll('[name="' + k + '"]');
        els.forEach(function (el) {
          if (el.type === 'radio') el.checked = (el.value === values[k]);
          else el.value = values[k];
        });
      });
    }
    try {
      var draft = JSON.parse(localStorage.getItem(KEY) || 'null');
      var serverHasValues = ${JSON.stringify(!fresh)};
      if (STAFF && draft && draft.values && !serverHasValues) {
        restore(draft.values);
        document.getElementById('draftWhen').textContent = new Date(draft.savedAt).toLocaleString();
        document.getElementById('draftNote').hidden = false;
      }
    } catch (e) {}
    if (STAFF) {
    var cBtn = document.getElementById('draftClear'), cConf = document.getElementById('clearConfirm');
    cBtn.onclick = function () { cBtn.hidden = true; cConf.hidden = false; };
    document.getElementById('clearNo').onclick = function () { cConf.hidden = true; cBtn.hidden = false; };
    document.getElementById('clearYes').onclick = function () { localStorage.removeItem(KEY); location.reload(); };
    }
    form.addEventListener('input', save);
    form.addEventListener('change', save);
    // Clicking an already-selected radio clears it (fixes mis-ticks).
    var last = {};
    form.querySelectorAll('input[type=radio]').forEach(function (r) {
      (r.closest('label') || r).addEventListener('mousedown', function () { last[r.name] = r.checked; });
      r.addEventListener('click', function () { if (last[r.name]) { r.checked = false; save(); sync(); } last[r.name] = false; });
      r.addEventListener('change', sync);
    });
    function sync() {
      var c = form.querySelector('input[name=pph_category]:checked');
      var hint = document.getElementById('dHint'); if (hint) hint.hidden = !(c && (c.value === 'Increased' || c.value === 'High'));
    }
    sync();
  })();
  </script>`;
  return layout({ title: isAdmin ? 'Edit record' : 'Checklist', hospitalName, body, admin });
}

// ---------------------------------------------------------------- printable record (shared by preview, admin view, HTML)
const PRINT_CSS = `
.doc { font-family: "Times New Roman", Times, serif; font-size: 11.5pt; color: #000; line-height: 1.3; }
.doc h1 { font-size: 12.5pt; font-weight: bold; margin: 0 0 10px; }
.doc h2 { font-size: 12pt; font-weight: bold; margin: 16px 0 6px; border: 0; padding: 0; }
.doc h3 { font-size: 11.5pt; font-weight: bold; margin: 10px 0 4px; }
.doc p { margin: 4px 0 8px; }
.doc table { border-collapse: collapse; width: 100%; margin: 4px 0 8px; }
.doc th, .doc td { border: 1px solid #000; padding: 2px 5px; vertical-align: top; font-size: 11pt; }
.doc th { font-weight: bold; text-align: center; background: #fff; }
.doc td.num { width: 28px; text-align: center; }
.doc td.opt { width: 48px; text-align: center; }
.doc .meta td { border: 0; padding: 1px 4px 1px 0; font-size: 11.5pt; }
.doc .meta td.k { font-weight: bold; width: 180px; }
.doc .meta td.v { border-bottom: 1px solid #000; }
.box { display: inline-block; width: 10px; height: 10px; border: 1px solid #000; vertical-align: -1px; margin: 0 2px 0 4px; position: relative; }
.box.on::after { content: ""; position: absolute; left: 1px; top: 1px; width: 6px; height: 6px; background: #000; }
.doc .fieldrow { margin: 6px 0; }
.doc .fieldrow b { display: inline-block; min-width: 180px; }
.doc .fieldval { border-bottom: 1px solid #000; display: inline-block; min-width: 260px; padding: 0 4px; }
.doc .block { border: 1px solid #000; min-height: 40px; padding: 4px 6px; white-space: pre-wrap; margin: 2px 0 8px; }
.doc .sig { margin-top: 18px; border-top: 1px solid #000; padding-top: 8px; font-size: 10.5pt; }
.doc ul { margin: 2px 0 8px 20px; }
`;

function boxes(options, cur) {
  return options.map((o) => `<span class="box${cur === o ? ' on' : ''}"></span>${esc(o)}`).join(' ');
}

function printField(f, d) {
  let val = d[f.id] ?? '';
  if (f.type === 'choice') {
    let h = boxes(f.options, val);
    if (f.other) h += ` <span class="fieldval" style="min-width:120px">${esc(d[f.other] ?? '')}</span>`;
    return `<div class="fieldrow"><b>${esc(f.label)}:</b> ${h}</div>`;
  }
  if (f.type === 'datetime') val = fmtDT(val);
  if (f.type === 'textarea') return `<div class="fieldrow"><b>${esc(f.label)}:</b><div class="block">${esc(val)}</div></div>`;
  return `<div class="fieldrow"><b>${esc(f.label)}:</b> <span class="fieldval">${esc(val)}</span>${f.unit ? ` ${esc(f.unit)}` : ''}</div>`;
}

// m: { hospitalName, department, staffName, recordId (null for preview), savedAt }
function printBody(d, m) {
  const hdr = FORM.header.map((f) => `<tr><td class="k">${esc(f.label)}:</td><td class="v">${esc(f.type === 'datetime' ? fmtDT(d[f.id]) : d[f.id] ?? '')}</td></tr>`).join('');
  return `<div class="doc">
  <h1>${esc(FORM.title)}</h1>
  <table class="meta"><tbody>
    <tr><td class="k">Hospital:</td><td>${esc(m.hospitalName)}</td></tr>
    <tr><td class="k">Department:</td><td>${esc(m.department)} Services</td></tr>
    <tr><td class="k">Form No.:</td><td>${m.recordId ? esc(formNo(m.recordId)) : '<i>assigned when saved</i>'}</td></tr>
    ${hdr}
  </tbody></table>

  ${FORM.sections.map((s) => `
  <h2>${esc(s.title)}</h2>
  ${s.note ? `<p>${esc(s.note)}</p>` : ''}
  ${(s.groups || []).map((g) => g.findings
    ? `${g.heading ? `<h3>${esc(g.heading)}</h3>` : ''}<table><thead><tr><th>Assessment item</th><th>Findings</th></tr></thead><tbody>
        ${g.items.map(([id, label, opts]) => `<tr><td>${esc(label)}</td><td>${boxes(opts, d[id])}</td></tr>`).join('')}</tbody></table>`
    : `${g.heading ? `<h3>${esc(g.heading)}</h3>` : ''}${g.instruction ? `<p>${esc(g.instruction)}</p>` : ''}<table><thead><tr><th>No.</th><th>${esc(g.col)}</th>${g.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>
        ${g.items.map(([id, label], i) => `<tr><td class="num">${i + 1}</td><td>${esc(label)}</td>${g.columns.map((c) => `<td class="opt"><span class="box${d[id] === c ? ' on' : ''}"></span></td>`).join('')}</tr>`).join('')}</tbody></table>`
  ).join('')}
  ${s.classification ? `<table><thead><tr><th>Risk category</th><th>Suggested criteria</th><th>Required action</th></tr></thead><tbody>${s.classification.map(([c, a, b]) => `<tr><td><b>${esc(c)}</b></td><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table>` : ''}
  ${(s.fields || []).map((f) => printField(f, d)).join('')}
  ${s.footnote ? `${s.footnote.title ? `<p><b>${esc(s.footnote.title)}</b></p>` : ''}${s.footnote.text ? `<p>${s.footnote.text}</p>` : ''}${s.footnote.bullets ? `<ul>${s.footnote.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>` : ''}` : ''}
  `).join('')}

  <div class="sig">
    <b>Completed electronically by:</b> ${esc(m.staffName)} (${esc(m.department)})${m.savedAt ? ` on ${esc(fmtDT(m.savedAt))}` : ''}.
    ${m.recordId ? `Record ${esc(formNo(m.recordId))} stored in the ${esc(m.hospitalName)} electronic forms system. No handwritten signature required.` : '<i>Not yet saved.</i>'}
  </div>
</div>`;
}

// ---------------------------------------------------------------- preview + success
function previewPage({ dept, name, desig, v, hospitalName }) {
  const hidden = Object.entries(v).map(([k, val]) => `<input type="hidden" name="${esc(k)}" value="${esc(val)}">`).join('');
  const bar = `
    <div class="actions">
      <form method="post" action="/submit">${hidden}${staffHidden(dept, name, desig)}
        <button class="btn" type="submit">Save and submit</button></form>
      <form method="post" action="/edit">${hidden}${staffHidden(dept, name, desig)}<button class="btn secondary" type="submit">Back to edit</button></form>
    </div>`;
  return layout({ title: 'Preview', hospitalName, extraHead: `<style>${PRINT_CSS}</style>`, body: `
  <div class="card"><h1>Preview</h1><p class="note">Check the form below. Nothing has been saved yet. Use <b>Back to edit</b> to change anything, or <b>Save and submit</b> to file it.</p>${bar}</div>
  <div class="card">${printBody(v, { hospitalName, department: dept, staffName: `${name}, ${desig}`, recordId: null, savedAt: null })}</div>
  <div class="card">${bar}</div>` });
}

function successPage({ record, pdfUrl, hospitalName, name, desig }) {
  return layout({ title: 'Saved', hospitalName, body: `
  <div class="card start">
    <h1>Saved</h1>
    <div class="success">Assessment <b>${esc(formNo(record.id))}</b> for <b>${esc(record.patientName)}</b> (Hospital No. ${esc(record.hospitalNo)}) has been filed under ${esc(record.department)}.</div>
    ${record.pdfPath ? `<div class="actions"><a class="btn" href="${esc(pdfUrl)}?download=1" download>Download PDF</a> <a class="btn secondary" href="${esc(pdfUrl)}" target="_blank">Open the PDF</a></div><p class="hint">Download the PDF to attach it in HMIS. You can find it again later with <b>Search patient</b> on the start page.</p>` : '<div class="error">The record was saved but the PDF file could not be written. Please tell ICT; they can regenerate it.</div>'}
    <div class="actions" style="margin-top:20px"><a class="btn secondary" href="/form?${staffQS(record.department, name, desig)}">Fill another form</a> <a class="btn secondary" href="/">Start page</a></div>
  </div>
  <script>try { localStorage.removeItem('aphpph:draft'); } catch (e) {}</script>` });
}

// ---------------------------------------------------------------- admin
const EYE = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function adminLoginPage({ hospitalName, error }) {
  return layout({ title: 'Admin sign-in', hospitalName, body: `
  <div class="card login">
    <h1>Admin sign-in</h1>
    <p class="note">For ICT and administrators. Staff do not need to sign in: use <a href="/records">Search patient</a> to find a filled form.</p>
    ${error ? `<div class="error">${esc(error)}</div>` : ''}
    <form method="post" action="/admin/login">
      <div class="field"><label for="u">Username</label><input id="u" type="text" name="username" autocomplete="username" autofocus required></div>
      <div class="field"><label for="p">Password</label>
        <div class="pw"><input id="p" type="password" name="password" autocomplete="current-password" required>
        <button type="button" class="eye" id="eye" aria-label="Show password" title="Show password">${EYE}</button></div>
      </div>
      <button class="btn" type="submit">Log in</button>
    </form>
  </div>
  <script>
  (function () {
    var p = document.getElementById('p'), b = document.getElementById('eye'), on = false;
    var EYE = ${JSON.stringify(EYE)}, OFF = ${JSON.stringify(EYE_OFF)};
    b.onclick = function () { on = !on; p.type = on ? 'text' : 'password'; b.innerHTML = on ? OFF : EYE; b.title = b.ariaLabel = on ? 'Hide password' : 'Show password'; p.focus(); };
  })();
  </script>` });
}

function adminList({ admin, rows, f, hospitalName, q }) {
  const opt = (v, cur, label) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label ?? v)}</option>`;
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  return layout({ title: 'Submissions', hospitalName, admin, body: `
  ${q.msg ? `<div class="success">${esc(q.msg)}</div>` : ''}${q.err ? `<div class="error">${esc(q.err)}</div>` : ''}
  <div class="card">
    <h1>Submitted assessments</h1>
    <form method="get" action="/admin" class="filters">
      <div><label>Search</label><input type="text" name="q" value="${esc(f.q)}" placeholder="Hospital no., patient or staff"></div>
      <div><label>Department</label><select name="dept">${opt('', f.dept, 'All')}${FORM.departments.map((d) => opt(d, f.dept)).join('')}</select></div>
      <div><label>PPH category</label><select name="cat">${opt('', f.cat, 'All')}${['Standard', 'Increased', 'High', 'Emergency'].map((c) => opt(c, f.cat)).join('')}</select></div>
      <div><label>From</label><input type="date" name="from" value="${esc(f.from)}"></div>
      <div><label>To</label><input type="date" name="to" value="${esc(f.to)}"></div>
      <div><button class="btn secondary" type="submit">Filter</button> <a class="btn secondary" href="/admin/export.csv?${esc(qs)}">Export CSV</a></div>
    </form>
    <table>
      <thead><tr><th>Form No.</th><th>Assessed</th><th>Hospital No.</th><th>Patient</th><th>Dept</th><th>Filled by</th><th>APH</th><th>PPH category</th><th>Submitted</th><th>PDF</th><th></th></tr></thead>
      <tbody>
      ${rows.length === 0 ? '<tr><td colspan="11" class="muted">No submissions found.</td></tr>' : ''}
      ${rows.map((r) => `<tr>
        <td>${esc(formNo(r.id))}</td>
        <td>${esc(fmtDT(r.assessedAt))}</td>
        <td>${esc(r.hospitalNo)}</td>
        <td><a href="/admin/records/${r.id}">${esc(r.patientName)}</a></td>
        <td>${esc(r.department)}</td>
        <td>${esc(r.staffName)}</td>
        <td>${esc(r.aphRisk || '')}</td>
        <td><span class="badge ${esc(r.pphCategory || '')}">${esc(r.pphCategory || '')}</span></td>
        <td>${esc(fmtDT(r.createdAt))}</td>
        <td style="white-space:nowrap">${r.pdfPath ? `<a href="/pdf/${r.id}" target="_blank">Open</a> · <a href="/pdf/${r.id}?download=1" download>Download</a>` : '<span class="muted">missing</span>'}</td>
        <td style="white-space:nowrap"><a class="btn small secondary" href="/admin/records/${r.id}">View</a> <a class="btn small secondary" href="/admin/records/${r.id}/edit">Edit</a></td>
      </tr>`).join('')}
      </tbody>
    </table>
    <p class="hint">Latest ${rows.length} matching submission(s), newest first (max 500).</p>
  </div>` });
}

function adminRecord({ admin, record, hospitalName, q }) {
  return layout({ title: formNo(record.id), hospitalName, admin, extraHead: `<style>${PRINT_CSS}</style>`, body: `
  ${q.msg ? `<div class="success">${esc(q.msg)}</div>` : ''}${q.err ? `<div class="error">${esc(q.err)}</div>` : ''}
  <div class="card">
    <div class="actions">
      ${record.pdfPath ? `<a class="btn" href="/pdf/${record.id}?download=1" download>Download PDF</a> <a class="btn secondary" href="/pdf/${record.id}" target="_blank">Open PDF</a>` : '<span class="muted">No PDF stored.</span>'}
      <form method="post" action="/admin/records/${record.id}/regenerate"><button class="btn secondary" type="submit">Regenerate PDF</button></form>
      <a class="btn secondary" href="/admin/records/${record.id}/edit">Edit</a>
      <a class="btn secondary" href="/admin">Back to list</a>
      <button class="btn danger" type="button" id="delBtn">Delete</button>
      <span id="delConfirm" hidden>Delete ${esc(formNo(record.id))} for ${esc(record.patientName)}? This cannot be undone.
        <form method="post" action="/admin/records/${record.id}/delete" style="display:inline"><button class="btn small danger" type="submit">Yes, delete</button></form>
        <button class="btn small secondary" type="button" id="delNo">Keep it</button></span>
    </div>
    <p class="hint">PDF file: ${esc(record.pdfPath || 'not generated')} · submitted ${esc(fmtDT(record.createdAt))}</p>
  </div>
  <div class="card">${printBody(record.data, { hospitalName, department: record.department, staffName: record.staffName, recordId: record.id, savedAt: record.createdAt })}</div>
  <script>
  (function () {
    var b = document.getElementById('delBtn'), c = document.getElementById('delConfirm');
    b.onclick = function () { b.hidden = true; c.hidden = false; };
    document.getElementById('delNo').onclick = function () { c.hidden = true; b.hidden = false; };
  })();
  </script>` });
}

// ---------------------------------------------------------------- patient search (read-only, no sign-in)
function recordsPage({ user, rows, f, searched, hospitalName }) {
  const opt = (v, cur, label) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label ?? v)}</option>`;
  return layout({ title: 'Search patient', hospitalName, admin: user, body: `
  <div class="card">
    <h1>Search patient</h1>
    <p class="note">Search by patient name or hospital number, then open or download the filled form. Records here cannot be changed.</p>
    <form method="get" action="/records" class="filters">
      <div style="flex:1;min-width:220px"><label for="rq">Patient name or Hospital No.</label><input id="rq" type="text" name="q" value="${esc(f.q)}" placeholder="e.g. Mary Wanjiru or 24680" autofocus></div>
      <div><label>Department</label><select name="dept">${opt('', f.dept, 'All')}${FORM.departments.map((d) => opt(d, f.dept)).join('')}</select></div>
      <div><label>From</label><input type="date" name="from" value="${esc(f.from)}"></div>
      <div><label>To</label><input type="date" name="to" value="${esc(f.to)}"></div>
      <div><button class="btn" type="submit">Search</button> ${searched ? '<a class="btn secondary" href="/records">Clear</a>' : ''}</div>
    </form>
    <table>
      <thead><tr><th>Form No.</th><th>Assessed</th><th>Hospital No.</th><th>Patient</th><th>Dept</th><th>Filled by</th><th>PPH category</th><th>Form</th></tr></thead>
      <tbody>
      ${rows.length === 0 ? `<tr><td colspan="8" class="muted">${searched ? 'No filled forms match this search.' : 'No filled forms yet.'}</td></tr>` : ''}
      ${rows.map((r) => `<tr>
        <td>${esc(formNo(r.id))}</td>
        <td>${esc(fmtDT(r.assessedAt))}</td>
        <td>${esc(r.hospitalNo)}</td>
        <td><a href="/records/${r.id}">${esc(r.patientName)}</a></td>
        <td>${esc(r.department)}</td>
        <td>${esc(r.staffName)}</td>
        <td><span class="badge ${esc(r.pphCategory || '')}">${esc(r.pphCategory || '')}</span></td>
        <td style="white-space:nowrap"><a class="btn small secondary" href="/records/${r.id}">View</a> ${r.pdfPath ? `<a class="btn small" href="/pdf/${r.id}?download=1" download>Download</a>` : '<span class="muted">no PDF</span>'}</td>
      </tr>`).join('')}
      </tbody>
    </table>
    <p class="hint">${searched ? `${rows.length} matching form(s), newest first (max 200).` : `The ${rows.length} most recent form(s). Search to find older ones.`}</p>
  </div>` });
}

function recordView({ user, record, hospitalName, q }) {
  return layout({ title: formNo(record.id), hospitalName, admin: user, extraHead: `<style>${PRINT_CSS}</style>`, body: `
  <div class="card">
    <div class="actions">
      ${record.pdfPath ? `<a class="btn" href="/pdf/${record.id}?download=1" download>Download PDF</a> <a class="btn secondary" href="/pdf/${record.id}" target="_blank">Open PDF</a>` : '<span class="muted">No PDF stored. Ask ICT to regenerate it.</span>'}
      <a class="btn secondary" href="/records">Back to search</a>
    </div>
  </div>
  <div class="card">${printBody(record.data, { hospitalName, department: record.department, staffName: record.staffName, recordId: record.id, savedAt: record.createdAt })}</div>` });
}

function errorPage({ status, message, hospitalName, admin }) {
  return layout({ title: `Error ${status}`, hospitalName, admin, body: `<div class="card"><h1>${status}</h1><p>${esc(message)}</p><p><a href="/">Start page</a></p></div>` });
}

module.exports = { esc, formNo, fmtDT, startPage, formPage, previewPage, successPage, adminLoginPage, adminList, adminRecord, recordsPage, recordView, errorPage, printBody };
