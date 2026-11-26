'use strict';
// Creates (or resets the password of) an admin account.
//   node create-admin.js                      -> asks for username and password
//   node create-admin.js <username> <password>
const readline = require('node:readline');
const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('./auth');

try { process.loadEnvFile(require('node:path').join(__dirname, '.env')); } catch { /* .env optional */ }

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Print the question once, then swallow echo while the password is typed.
      process.stdout.write(question);
      rl._writeToOutput = (s) => { if (s.includes('\n')) process.stdout.write('\n'); };
    }
    rl.question(hidden ? '' : question, (a) => { rl.close(); resolve(a.trim()); });
  });
}

(async () => {
  const args = process.argv.slice(2);
  const role = 'admin';
  const kind = 'Admin';
  let [username, password] = args;
  if (!username) username = await ask(`${kind} username: `);
  if (!password) {
    password = await ask('Password (typing is hidden): ', { hidden: true });
    const again = await ask('Repeat password: ', { hidden: true });
    if (password !== again) { console.error('Passwords do not match. Nothing changed.'); process.exit(1); }
  }
  if (!/^[A-Za-z0-9._-]{3,30}$/.test(username)) { console.error('Username: 3-30 letters, digits, dot, dash or underscore.'); process.exit(1); }
  if (password.length < 8) { console.error('Password must be at least 8 characters.'); process.exit(1); }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.admin.findUnique({ where: { username } });
    await prisma.admin.upsert({
      where: { username },
      create: { username, passwordHash: hashPassword(password), role },
      update: { passwordHash: hashPassword(password), role },
    });
    if (existing) await prisma.adminSession.deleteMany({ where: { adminId: existing.id } });
    console.log(existing ? `${kind} account "${username}" updated (new password).` : `${kind} account "${username}" created.`);
    console.log('Sign in at http://<server>:<port>/admin');
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
