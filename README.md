# APH/PPH Risk Assessment Checklist – intranet form

Electronic version of the *Maternity Unit: APH/PPH Risk Assessment Checklist* (Form No. MAT/CLIN/…)
for the Maternity and MCH departments.

**Staff flow (no accounts):** open the page → choose Maternity or MCH → type your name and your
designation in their own boxes → fill the checklist ("Name and designation of assessing staff" is filled from the start page) → **Preview** → **Save and submit**. The form is saved in the browser as you type, so if
the page is closed before submitting, the next visit offers to continue it.

**On submit:** the record goes into PostgreSQL and a PDF is written to the shared folder as
`<OUTPUT_DIR>\<Department>\<YYYY>\<MM>\<HospitalNo>_<date>_<time>_MAT-CLIN-000123.pdf`.

**Search patient (`/records`, no sign-in):** the **Search patient** button on the start page (and in
the top bar) opens a search by patient name or hospital number. Staff can view filled forms and open
or download the PDF (e.g. to attach in HMIS), but cannot edit, delete or export. Every view and
download is written to the log with the computer's IP address. Anyone on the hospital network can use
it, so keep the app reachable only inside the LAN.

**Admin (`/admin`):** account created with `create-admin.bat`. Sees every submission, with search,
filters, PDF links, record view, PDF regeneration and CSV export. Admins can also **edit** a
record (the PDF is redrawn) or **delete** it (the PDF is moved to `<OUTPUT_DIR>\_deleted`), and
**New form** in the top bar opens a blank checklist.

Stack: Node.js, Express, PostgreSQL, Prisma. PDFs are drawn by the app itself (no browser needed).

## Install on the server (Windows)

1. Install **Node.js LTS** (https://nodejs.org) and **PostgreSQL** (https://www.postgresql.org/download/windows/).
   Then install PM2 once (in a Command Prompt):

   ```
   npm install -g pm2 pm2-windows-startup
   ```

2. Copy this folder to the server, e.g. `C:Appsaph-pph-forms`, and in it run:

   ```
   npm install
   ```

3. Edit **.env**: put the postgres password into `DATABASE_URL`, set `OUTPUT_DIR` to the shared
   folder, and check `HOSPITAL_NAME` and `PORT`. `SESSION_SECRET` is already a random value.
   (If there is no .env, copy `.env.example` to `.env` first.)
4. Create the database and tables: double-click **setup-db.bat**. It asks for the postgres password
   once, creates `maternity_forms`, then runs the Prisma migrations.
5. Create the admin account: double-click **create-admin.bat** (asks for username and password,
   typing hidden) or run `create-admin.bat <username> <password>`. Run it again later to reset a password.
6. Start it and keep it running: double-click **pm2-start.bat**. It starts the app under PM2,
   saves the process list and registers PM2 to start at Windows boot, so the form comes back by
   itself after a restart or a crash. Then open `http://localhost:8080` and `http://localhost:8080/admin`.
7. Allow the port through Windows Firewall on the LAN (elevated Command Prompt):

   ```
   netsh advfirewall firewall add rule name="APH-PPH Forms" dir=in action=allow protocol=TCP localport=8080 profile=domain,private
   ```

8. Give the wards the address (e.g. `http://192.168.0.254:8080`) and put a shortcut on the ward PCs.
   Admins click the **Admin** lock at the top right of any page to sign in.

### Day to day (PM2)

| task                         | how                                   |
|------------------------------|---------------------------------------|
| status                       | `pm2 status`                          |
| live log                     | `pm2 logs aph-pph-forms`              |
| restart / install an update  | `pm2-restart.bat` (also applies database updates) |
| stop                         | `pm2-stop.bat`                        |
| start again                  | `pm2-start.bat`                       |

Logs are written to `logsout.log` and `logserror.log` in the app folder. PM2 runs under the
Windows account that ran `pm2-start.bat`; if `OUTPUT_DIR` is a network share, that account must be
able to write to it (the startup entry is created for the same account).

## Notes

- **Draft caching** lives in the browser's localStorage of that PC/profile. It survives closing the
  tab or browser; it is cleared when the form is submitted or "Discard" is clicked. Each ward PC
  holds its own draft (one at a time).
- **PDF links for staff** on the "Saved" page work for 12 hours; after that only admins can open PDFs.
- **Lost PDF** (share offline at the time): admin opens the record → Regenerate PDF.
- **Backups**: the Postgres database (system of record) and `OUTPUT_DIR`. PDFs can always be regenerated.
- **Changing the form**: everything (sections, items, options, footnotes) is in `form.js`.
  The entry page, preview, admin view and PDF are all generated from it. Keep item ids stable.
- **Security**: admin passwords are scrypt-hashed; sessions are HttpOnly cookies; POSTs are checked
  for same-origin; 10 failed admin logins block that address for 5 minutes. Traffic is plain HTTP on
  the LAN; put IIS/nginx with the hospital certificate in front if HTTPS is required.

## Files

| file                  | purpose                                          |
|-----------------------|--------------------------------------------------|
| `server.js`           | Express app: staff flow, PDF, admin              |
| `form.js`             | the checklist definition                         |
| `views.js`            | HTML pages (start, form, preview, admin)         |
| `pdfgen.js`           | built-in PDF writer                              |
| `auth.js`             | password hashing                                 |
| `create-admin.js/.bat`| create or reset an admin account                 |
| `prisma/schema.prisma`| database schema; `prisma/migrations` the tables  |
| `ecosystem.config.js` | PM2 process definition                           |
| `pm2-*.bat`           | start / stop / restart under PM2                 |
| `setup-db.bat`        | creates the database and tables                  |
| `public/style.css`    | styling                                          |

# aap-pph-checklist
