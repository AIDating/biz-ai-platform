export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { ensureConstraints } = await import("./lib/db");
  try {
    await ensureConstraints();
  } catch (error) {
    console.error("Database constraints were not applied yet.", error);
  }
}
