-- Staff viewer accounts: same login, read-only access to filled forms.
ALTER TABLE "Admin" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'admin';
