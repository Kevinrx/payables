/**
 * Loads env vars from .env.local first, then .env (no override).
 * Next.js does this automatically at runtime, but standalone scripts
 * (drizzle-kit, seed) need an explicit loader.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const cwd = process.cwd();
const local = resolve(cwd, ".env.local");
const base = resolve(cwd, ".env");

if (existsSync(local)) config({ path: local });
if (existsSync(base)) config({ path: base });
