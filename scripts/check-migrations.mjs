import { readdirSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b));

const errors = [];
const versions = new Map();
const migrationNamePattern = /^\d{3}_[a-z0-9][a-z0-9_]*\.sql$/;

for (const file of files) {
  if (!migrationNamePattern.test(file)) {
    errors.push(`${file}: migration files must be named like 000_description.sql`);
    continue;
  }

  const version = file.slice(0, 3);
  const existing = versions.get(version);

  if (existing) {
    errors.push(`${file}: duplicate migration version ${version}; also used by ${existing}`);
  } else {
    versions.set(version, file);
  }
}

if (errors.length > 0) {
  console.error("Supabase migration filename check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Supabase migration filename check passed (${files.length} files).`);
