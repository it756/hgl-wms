import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";

const image = "public.ecr.aws/supabase/postgres:17.11.0.002";
const container = `hgl-catalogue-test-${process.pid}`;
let created = false;

function docker(args, input) {
  const result = spawnSync("docker", args, {
    input,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(result.stderr || result.stdout || `docker ${args[0]} failed`);
  return result.stdout;
}

try {
  docker([
    "run",
    "--name",
    container,
    "--network",
    "none",
    "-d",
    "-e",
    "POSTGRES_PASSWORD=catalogue-local-test-only",
    image,
  ]);
  created = true;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const logs = spawnSync("docker", ["logs", container], { encoding: "utf8", timeout: 10_000 });
    if (!`${logs.stdout}${logs.stderr}`.includes("PostgreSQL init process complete")) {
      await setTimeout(1000);
      continue;
    }
    const status = spawnSync("docker", ["exec", container, "pg_isready", "-U", "postgres"], {
      encoding: "utf8",
      timeout: 10_000,
    });
    if (status.status === 0) {
      ready = true;
      break;
    }
    await setTimeout(1000);
  }
  if (!ready) throw new Error("Isolated PostgreSQL did not become ready.");
  for (const database of ["catalogue_new_extension", "catalogue_existing_extension"]) {
    docker(["exec", container, "createdb", "-U", "postgres", database]);
    const args = [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
    ];
    if (database === "catalogue_existing_extension") {
      docker(args, "CREATE EXTENSION pg_trgm WITH SCHEMA public;");
    }
    for (const file of [
      join("tests", "sql", "catalogue-fixture.sql"),
      join("supabase", "migrations", "046_paginated_sbu_catalogue.sql"),
      join("tests", "sql", "catalogue-assertions.sql"),
    ]) {
      console.log(docker(args, readFileSync(join(process.cwd(), file), "utf8")).trim());
    }
    docker(
      args,
      readFileSync(
        join(process.cwd(), "supabase", "migrations", "046_paginated_sbu_catalogue.sql"),
        "utf8",
      ),
    );
    console.log(`${database}: passed, including migration reapplication.`);
  }
  console.log("Catalogue PostgreSQL regression tests passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (created) {
    try {
      docker(["rm", "-f", container]);
    } catch (error) {
      console.error("Failed to clean up test container:", error);
      process.exitCode = 1;
    }
  }
}
