import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import type { PoolClient } from "pg";

interface MigrationRecord {
  version: string;
  checksum: string;
}

export interface MigrationOptions {
  readonly connectionString?: string;
  readonly targetVersion?: string;
}

export async function runMigrations(
  options: MigrationOptions = {},
): Promise<void> {
  const connectionString =
    options.connectionString ?? process.env.DATABASE_URL_MIGRATION;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL_MIGRATION is required; migrations must never use the runtime connection.",
    );
  }

  const pool = new Pool({ connectionString, max: 1 });
  let client: PoolClient | undefined;
  let lockAcquired = false;

  try {
    client = await pool.connect();
    await client.query("SELECT pg_advisory_lock($1)", [724901]);
    lockAcquired = true;
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const directory = resolve(__dirname, "../database/migrations");
    const files = (await readdir(directory))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      if (options.targetVersion && version > options.targetVersion) {
        break;
      }
      const sql = await readFile(resolve(directory, file), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = await client.query<MigrationRecord>(
        "SELECT version, checksum FROM schema_migrations WHERE version = $1",
        [version],
      );

      if (existing.rowCount) {
        if (existing.rows[0]?.checksum !== checksum) {
          throw new Error(`Applied migration checksum changed: ${version}`);
        }
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)",
          [version, checksum],
        );
        await client.query("COMMIT");
        process.stdout.write(`Applied migration ${version}\n`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    try {
      if (client && lockAcquired) {
        await client.query("SELECT pg_advisory_unlock($1)", [724901]);
      }
    } finally {
      client?.release();
      await pool.end();
    }
  }
}

if (require.main === module) {
  void runMigrations().catch((error: unknown) => {
    process.stderr.write(
      error instanceof Error
        ? `${error.stack ?? error.message}\n`
        : `${String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
