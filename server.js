'use strict';
// APH/PPH Risk Assessment Checklist: intranet form for Maternity and MCH.
// Staff: choose department, enter name, fill, preview, submit -> PDF in the shared folder + row in Postgres.
// Admin: /admin (account created with create-admin.bat) sees every submission.
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const { PrismaClient } = require('@prisma/client');

try { process.loadEnvFile(path.join(__dirname, '.env')); } catch { /* environment may be set another way */ }

const V = require('./views');
const { FORM, allFields } = require('./form');
const { renderRecordPdf } = require('./pdfgen');
const { verifyPassword, pdfToken, checkPdfToken } = require('./auth');

const HOSPITAL = process.env.HOSPITAL_NAME || 'Hospital';
const PORT = Number(process.env.PORT || 8080);
const DEFAULT_HOSPITAL_NO = process.env.DEFAULT_HOSPITAL_NO || '10100';
const OUTPUT_DIR = path.resolve(__dirname, process.env.OUTPUT_DIR || './output');
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_HOURS = 12;
const FIELDS = allFields();

const prisma = new PrismaClient();
const app = express();
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use('/style.css', express.static(path.join(__dirname, 'public', 'style.css'), { maxAge: '5m' }));
app.use((req, res, next) => { res.set({ 'Cache-Control': 'no-store', 'X-Frame-Options': 'SAMEORIGIN', 'X-Content-Type-Options': 'nosniff' }); next(); });

const log = (...a) => console.log(new Date().toISOString().slice(0, 19).replace('T', ' '), ...a);

// ---------------------------------------------------------------- helpers
function sameOrigin(req) {
  const src = req.headers.origin || req.headers.referer;
  if (!src) return false;
  try { return new URL(src).host === req.headers.host; } catch { return false; }
}
function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function withMsg(to, msg, err) {
  const u = new URL(to, 'http://x');
  if (msg) u.searchParams.set('msg', msg);
  if (err) u.searchParams.set('err', err);
  return u.pathname + u.search;
}
function safeName(s) { return String(s).replace(/[^A-Za-z0-9-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'NA'; }
function localIso(d) { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }

// Validation: returns clean values and a map of field -> error message.
function validate(body) {
  const v = {}; const errors = {};
  for (const f of FIELDS) {
    let val = String(body[f.id] ?? '').trim();
    if (f.type === 'choice' && val && !f.options.includes(val)) { errors[f.id] = `${f.label}: invalid value`; val = ''; }
    if (f.type === 'number' && val) {
      const n = Number(val);
      if (!Number.isFinite(n)) errors[f.id] = `${f.label}: must be a number`;
      else if ((f.min != null && n < f.min) || (f.max != null && n > f.max)) errors[f.id] = `${f.label}: must be between ${f.min} and ${f.max}`;
    }
    if (f.type === 'datetime' && val) {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(val) || isNaN(new Date(val).getTime())) errors[f.id] = `${f.label}: invalid date/time`;
      else val = val.slice(0, 16);
    }
    if (f.type === 'text' && val.length > 500) errors[f.id] = `${f.label}: too long`;
    if (f.type === 'textarea' && val.length > 4000) errors[f.id] = `${f.label}: too long`;
    if (f.required && !val) errors[f.id] = `${f.label} is required`;
    v[f.id] = val;
  }
  const dept = String(body.dept || '').trim();
  const name = String(body.name || '').trim().slice(0, 80);
  const desig = String(body.desig || '').trim().slice(0, 60);
  if (!FORM.departments.includes(dept)) errors.dept = 'Please choose a department';
  if (!name) errors.name = 'Please enter your name';
  else if (!desig) errors.name = 'Please enter your designation';
  return { v, errors, dept, name, desig };
}

// ---------------------------------------------------------------- PDF
async function writePdf(record) {
  const m = { hospitalName: HOSPITAL, department: record.department, recordId: record.id, staffName: record.staffName, savedAt: record.createdAt };
  const when = localIso(record.assessedAt).replace(/[-:]/g, '').replace('T', '_');
  const [yyyy, mm] = when.split('_')[0].match(/^(\d{4})(\d{2})/).slice(1);
  const file = `${safeName(record.hospitalNo)}_${when}_${V.formNo(record.id).replace(/\//g, '-')}.pdf`;
  const out = path.join(OUTPUT_DIR, record.department, yyyy, mm, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const tmp = out + '.part';
  fs.writeFileSync(tmp, renderRecordPdf(record.data, m));
  fs.renameSync(tmp, out);
  await prisma.submission.update({ where: { id: record.id }, data: { pdfPath: out } });
  return out;
}

// ---------------------------------------------------------------- admin sessions
async function currentAdmin(req) {
  const sid = cookies(req).admin_sid;
  if (!sid) return null;
  const s = await prisma.adminSession.findUnique({ where: { id: sid }, include: { admin: true } });
  if (!s) return null;
  if (s.expiresAt < new Date()) { await prisma.adminSession.delete({ where: { id: sid } }).catch(() => {}); return null; }
  return s.admin;
}
const loginFails = new Map();
function loginBlocked(ip) { const f = loginFails.get(ip); return f && f.count >= 10 && Date.now() - f.last < 5 * 60e3; }

// ---------------------------------------------------------------- staff flow
app.get('/', (req, res) => res.send(V.startPage({ hospitalName: HOSPITAL, error: req.query.err })));

app.get('/form', (req, res) => {
  const dept = String(req.query.dept || '');
  const name = String(req.query.name || '').trim().slice(0, 80);
  const desig = String(req.query.desig || '').trim().slice(0, 60);
  if (!FORM.departments.includes(dept) || !name || !desig) return res.redirect(withMsg('/', null, 'Please choose a department and enter your name and designation.'));
  // Defaults: hospital number, assessment time, and the assessor taken from the start page.
  const v = { hospital_no: DEFAULT_HOSPITAL_NO, assessed_at: localIso(new Date()), assessor_name: `${name}, ${desig}` };
  res.send(V.formPage({ dept, name, desig, v, errors: {}, hospitalName: HOSPITAL, fresh: true }));
});

// "Back to edit" from the preview: reopen the form with the previewed answers.
app.post('/edit', (req, res) => {
  if (!sameOrigin(req)) return res.status(403).send('Forbidden');
  const { v, errors, dept, name, desig } = validate(req.body);
  if (errors.dept || errors.name) return res.redirect(withMsg('/', null, 'Please choose a department and enter your name and designation.'));
  res.send(V.formPage({ dept, name, desig, v, errors: {}, hospitalName: HOSPITAL }));
});

app.post('/preview', (req, res) => {
  if (!sameOrigin(req)) return res.status(403).send('Forbidden');
  const { v, errors, dept, name, desig } = validate(req.body);
  if (errors.dept || errors.name) return res.redirect(withMsg('/', null, 'Please choose a department and enter your name and designation.'));
  if (Object.keys(errors).length) return res.status(400).send(V.formPage({ dept, name, desig, v, errors, hospitalName: HOSPITAL }));
  res.send(V.previewPage({ dept, name, desig, v, hospitalName: HOSPITAL }));
});

app.post('/submit', async (req, res) => {
  if (!sameOrigin(req)) return res.status(403).send('Forbidden');
  const { v, errors, dept, name, desig } = validate(req.body);
  if (errors.dept || errors.name) return res.redirect(withMsg('/', null, 'Please choose a department and enter your name and designation.'));
  if (Object.keys(errors).length) return res.status(400).send(V.formPage({ dept, name, desig, v, errors, hospitalName: HOSPITAL }));
  const record = await prisma.submission.create({
    data: { department: dept, staffName: `${name}, ${desig}`, patientName: v.patient_name, hospitalNo: v.hospital_no, assessedAt: new Date(v.assessed_at), aphRisk: v.aph_risk || null, pphCategory: v.pph_category || null, data: v },
  });
  let pdfPath = null;
  try { pdfPath = await writePdf(record); log(`saved ${V.formNo(record.id)} by ${name}, ${desig} (${dept}) -> ${pdfPath}`); }
  catch (e) { log(`PDF FAILED for ${V.formNo(record.id)}: ${e.message}`); }
  res.send(V.successPage({ record: { ...record, pdfPath }, pdfUrl: `/pdf/${record.id}?t=${pdfToken(SECRET, record.id)}`, hospitalName: HOSPITAL, name, desig }));
});

app.get('/pdf/:id', async (req, res) => {
  const id = Number(req.params.id);
  const admin = await currentAdmin(req);
  if (!admin && !checkPdfToken(SECRET, id, req.query.t)) return res.status(403).send(V.errorPage({ status: 403, message: 'This PDF link has expired. Ask an administrator to open it from /admin.', hospitalName: HOSPITAL }));
  const r = await prisma.submission.findUnique({ where: { id } });
  if (!r || !r.pdfPath || !fs.existsSync(r.pdfPath)) return res.status(404).send(V.errorPage({ status: 404, message: 'PDF not found. An administrator can regenerate it.', hospitalName: HOSPITAL, admin }));
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${path.basename(r.pdfPath)}"` });
  fs.createReadStream(r.pdfPath).pipe(res);
});

// ---------------------------------------------------------------- admin
app.get('/admin', async (req, res) => {
  const admin = await currentAdmin(req);
  if (!admin) return res.send(V.adminLoginPage({ hospitalName: HOSPITAL }));
  const f = { q: String(req.query.q || ''), dept: String(req.query.dept || ''), cat: String(req.query.cat || ''), from: String(req.query.from || ''), to: String(req.query.to || '') };
  const rows = await prisma.submission.findMany({ where: filterWhere(f), orderBy: [{ assessedAt: 'desc' }, { id: 'desc' }], take: 500 });
  res.send(V.adminList({ admin, rows, f, hospitalName: HOSPITAL, q: req.query }));
});

function filterWhere(f) {
  const where = {};
  if (f.q) where.OR = [{ hospitalNo: { contains: f.q, mode: 'insensitive' } }, { patientName: { contains: f.q, mode: 'insensitive' } }, { staffName: { contains: f.q, mode: 'insensitive' } }];
  if (FORM.departments.includes(f.dept)) where.department = f.dept;
  if (f.cat) where.pphCategory = f.cat;
  if (f.from || f.to) {
    where.assessedAt = {};
    if (f.from && !isNaN(Date.parse(f.from))) where.assessedAt.gte = new Date(f.from + 'T00:00');
    if (f.to && !isNaN(Date.parse(f.to))) where.assessedAt.lte = new Date(f.to + 'T23:59:59');
  }
  return where;
}

app.post('/admin/login', async (req, res) => {
  if (!sameOrigin(req)) return res.status(403).send('Forbidden');
  const ip = req.socket.remoteAddress;
  if (loginBlocked(ip)) return res.status(429).send(V.adminLoginPage({ hospitalName: HOSPITAL, error: 'Too many failed attempts. Try again in 5 minutes.' }));
  const admin = await prisma.admin.findUnique({ where: { username: String(req.body.username || '').trim() } });
  if (!admin || !verifyPassword(String(req.body.password || ''), admin.passwordHash)) {
    const f = loginFails.get(ip) || { count: 0 }; f.count++; f.last = Date.now(); loginFails.set(ip, f);
    log(`admin login failed for "${req.body.username}" from ${ip}`);
    return res.status(401).send(V.adminLoginPage({ hospitalName: HOSPITAL, error: 'Wrong username or password.' }));
  }
  loginFails.delete(ip);
  const sid = crypto.randomBytes(32).toString('hex');
  await prisma.adminSession.create({ data: { id: sid, adminId: admin.id, expiresAt: new Date(Date.now() + SESSION_HOURS * 3600e3) } });
  await prisma.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  res.cookie('admin_sid', sid, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: SESSION_HOURS * 3600e3 });
  res.redirect('/admin');
});

app.post('/admin/logout', async (req, res) => {
  const sid = cookies(req).admin_sid;
  if (sid) await prisma.adminSession.deleteMany({ where: { id: sid } });
  res.clearCookie('admin_sid', { path: '/' });
  res.redirect('/admin');
});

app.get('/admin/records/:id', async (req, res) => {
  const admin = await currentAdmin(req);
  if (!admin) return res.redirect('/admin');
  const record = await prisma.submission.findUnique({ where: { id: Number(req.params.id) } });
  if (!record) return res.status(404).send(V.errorPage({ status: 404, message: 'Record not found.', hospitalName: HOSPITAL, admin }));
  res.send(V.adminRecord({ admin, record, hospitalName: HOSPITAL, q: req.query }));
});

app.post('/admin/records/:id/regenerate', async (req, res) => {
  const admin = await currentAdmin(req);
  if (!admin || !sameOrigin(req)) return res.redirect('/admin');
  const record = await prisma.submission.findUnique({ where: { id: Number(req.params.id) } });
  if (!record) return res.redirect('/admin');
  try { const out = await writePdf(record); res.redirect(withMsg(`/admin/records/${record.id}`, `PDF regenerated: ${out}`)); }
  catch (e) { log(`PDF regenerate FAILED for ${record.id}: ${e.message}`); res.redirect(withMsg(`/admin/records/${record.id}`, null, `PDF could not be written: ${e.message}`)); }
});

app.get('/admin/export.csv', async (req, res) => {
  const admin = await currentAdmin(req);
  if (!admin) return res.redirect('/admin');
  const f = { q: String(req.query.q || ''), dept: String(req.query.dept || ''), cat: String(req.query.cat || ''), from: String(req.query.from || ''), to: String(req.query.to || '') };
  const rows = await prisma.submission.findMany({ where: filterWhere(f), orderBy: { assessedAt: 'desc' } });
  const cols = ['form_no', 'department', 'staff_name', 'submitted_at', ...FIELDS.map((x) => x.id)];
  const cell = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lines = [cols.join(',')];
  for (const r of rows) lines.push([V.formNo(r.id), r.department, r.staffName, V.fmtDT(r.createdAt), ...FIELDS.map((x) => r.data[x.id])].map(cell).join(','));
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="aph-pph-submissions.csv"' });
  res.send('﻿' + lines.join('\r\n'));
});

// ---------------------------------------------------------------- errors + start
app.use((req, res) => res.status(404).send(V.errorPage({ status: 404, message: 'Page not found.', hospitalName: HOSPITAL })));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  log(`ERROR ${req.method} ${req.path}: ${err.stack || err}`);
  res.status(500).send(V.errorPage({ status: 500, message: 'Something went wrong. Please tell ICT.', hospitalName: HOSPITAL }));
});

prisma.$connect().then(() => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  app.listen(PORT, '0.0.0.0', () => {
    log(`APH/PPH checklist listening on http://0.0.0.0:${PORT}  (admin at /admin)`);
    log(`PDF output: ${OUTPUT_DIR}`);
    if (!process.env.SESSION_SECRET) log('WARNING: SESSION_SECRET not set in .env; admin sessions and PDF links will reset on restart');
  });
}).catch((e) => { console.error('Cannot connect to the database. Check DATABASE_URL in .env and run "npm run setup".\n', e.message); process.exit(1); });
