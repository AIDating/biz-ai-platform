import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

process.env.TZ = "UTC";
process.env.DATABASE_URL = "file:./test.db";
process.env.SESSION_SECRET = "test-session-secret-value";
process.env.OPENAI_API_KEY = "";

rmSync("prisma/test.db", { force: true });
execSync("npx prisma db push --skip-generate --accept-data-loss", {
  stdio: "inherit",
  env: process.env,
});

const { ensureConstraints } = await import("../src/lib/db");
await ensureConstraints();
