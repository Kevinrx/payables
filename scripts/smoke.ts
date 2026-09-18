/**
 * End-to-end smoke test: hits every route on a configurable BASE_URL and
 * asserts 200 + expected content. Used to verify a deploy is alive.
 *
 *   npm run smoke                              # local (http://localhost:3000)
 *   npm run smoke -- https://your.vercel.app   # production
 */
const BASE = (process.argv[2] || process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");

type Check = {
  name: string;
  path: string;
  expectStatus?: number;
  mustContain?: string[];
};

const CHECKS: Check[] = [
  {
    name: "root redirects",
    path: "/",
    expectStatus: 200, // Next follows the redirect; we get /bills HTML
    mustContain: ["Payables", "Bills"],
  },
  {
    name: "bills list",
    path: "/bills",
    mustContain: ["Payables", "outstanding", "Due in 7 days"],
  },
  {
    name: "aging report",
    path: "/aging",
    mustContain: ["AP Aging", "Current", "1–30 days", "31–60 days"],
  },
  {
    name: "vendors list",
    path: "/vendors",
    mustContain: ["Vendors", "Outstanding"],
  },
  {
    name: "new bill page",
    path: "/bills/new",
    mustContain: ["Upload an invoice", "Or create a bill without an invoice"],
  },
  {
    name: "csv import page",
    path: "/bills/import",
    mustContain: ["Import from CSV", "vendor_name", "total"],
  },
];

type Outcome =
  | { check: Check; ok: true; status: number; ms: number }
  | { check: Check; ok: false; status: number; ms: number; reason: string };

async function run(check: Check): Promise<Outcome> {
  const url = `${BASE}${check.path}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, { redirect: "follow" });
    const ms = Date.now() - t0;
    const expected = check.expectStatus ?? 200;
    if (res.status !== expected) {
      return {
        check,
        ok: false,
        status: res.status,
        ms,
        reason: `expected status ${expected}, got ${res.status}`,
      };
    }
    if (check.mustContain && check.mustContain.length > 0) {
      const body = await res.text();
      const missing = check.mustContain.filter((s) => !body.includes(s));
      if (missing.length > 0) {
        return {
          check,
          ok: false,
          status: res.status,
          ms,
          reason: `missing content: ${missing.map((s) => JSON.stringify(s)).join(", ")}`,
        };
      }
    }
    return { check, ok: true, status: res.status, ms };
  } catch (e) {
    return {
      check,
      ok: false,
      status: 0,
      ms: Date.now() - t0,
      reason: e instanceof Error ? e.message : "unknown error",
    };
  }
}

async function main() {
  console.log(`Smoke testing ${BASE}\n`);
  const results = await Promise.all(CHECKS.map(run));

  for (const r of results) {
    const status = r.ok ? "✓" : "✗";
    const color = r.ok ? "\x1b[32m" : "\x1b[31m";
    const reset = "\x1b[0m";
    const meta = `${r.status || "ERR"} · ${r.ms}ms`;
    console.log(`${color}${status}${reset} ${r.check.name.padEnd(24)} ${r.check.path.padEnd(20)} ${meta}`);
    if (!r.ok) console.log(`    \x1b[31m└─ ${r.reason}\x1b[0m`);
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
