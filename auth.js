'use strict';
const crypto = require('node:crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password, salt, 32).toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const a = crypto.scryptSync(password, salt, 32);
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Short-lived signed token so the staff member who just submitted can open their own PDF.
function sign(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}
function pdfToken(secret, id, hours = 12) {
  const exp = Date.now() + hours * 3600e3;
  return `${exp}.${sign(secret, `${id}.${exp}`)}`;
}
function checkPdfToken(secret, id, token) {
  const [exp, sig] = String(token || '').split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const want = sign(secret, `${id}.${exp}`);
  return want.length === sig.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig));
}

module.exports = { hashPassword, verifyPassword, pdfToken, checkPdfToken };
