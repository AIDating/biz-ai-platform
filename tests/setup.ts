import { execSync } from "node:child_process";

process.env.TZ = "UTC";
process.env.SESSION_SECRET ??= "test-session-secret-value";
process.env.OPENAI_API_KEY ??= "";

const url = process.env.DATABASE_URL ?? "";
const direct = process.env.DATABASE_URL_UNPOOLED ?? "";
if (!url.startsWith("postgres") || !direct.startsWith("postgres")) {
  throw new Error(
    "Tests need DATABASE_URL and DATABASE_URL_UNPOOLED set to Postgres (Neon). SQLite is no longer supported.",
  );
}

execSync("npx prisma db push --skip-generate --accept-data-loss", {
  stdio: "inherit",
  env: process.env,
});

const { ensureConstraints } = await import("../src/lib/db");
await ensureConstraints();
