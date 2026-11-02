// Simple load test: node scripts/loadtest.mjs https://your-site.netlify.app 50 10
// (base URL, total requests, concurrency). Uses Google's test election so it doesn't touch real data.
// Each uncached request uses Google Civic API quota, so keep totals modest.
const [base = "http://localhost:5173", total = "50", conc = "10"] = process.argv.slice(2);
const body = JSON.stringify({ address: "340 Main St, Venice, CA 90291", electionId: "2000" });
const times = [];
let failures = 0;
let started = 0;

async function one() {
  const t = performance.now();
  const r = await fetch(`${base}/api/voterinfo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  }).catch(() => null);
  times.push(performance.now() - t);
  if (!r || !r.ok) failures++;
}

await Promise.all(
  Array.from({ length: Number(conc) }, async () => {
    while (started++ < Number(total)) await one();
  }),
);
times.sort((a, b) => a - b);
const p = (q) => Math.round(times[Math.min(times.length - 1, Math.floor(q * times.length))]);
console.log({ requests: times.length, failures, p50_ms: p(0.5), p95_ms: p(0.95), max_ms: p(1) });
