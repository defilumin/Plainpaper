import React, { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const C = {
  bg: "#0A0D14", panel: "#121826", panel2: "#0F1420", line: "#222B3D",
  text: "#E7ECF5", muted: "#8A93A6", accent: "#6E8BFF", mint: "#2DD4BF",
  violet: "#A78BFA", amber: "#F5B454", red: "#F87171",
};
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const CHART_COLORS = ["#6E8BFF", "#2DD4BF", "#A78BFA", "#F5B454", "#F87171", "#5EEAD4", "#818CF8"];

const LEVELS = {
  beginner: { label: "Beginner", note: "Explain for a curious adult who is brand new to crypto. Use plain language and define every technical term simply." },
  expert: { label: "Expert", note: "Write for a technically sophisticated, crypto-native reader. Go deep into the real mechanisms: the consensus algorithm internals, cryptographic primitives, data structures, network architecture, issuance and incentive design, and notable technical tradeoffs or limitations. Use correct terminology and assume familiarity with programming and basic cryptography. Make every field substantially more detailed and technical than a beginner summary — it must NOT read like the beginner version." },
};

const POPULAR = [
  { name: "Bitcoin", ticker: "BTC" }, { name: "Ethereum", ticker: "ETH" },
  { name: "Solana", ticker: "SOL" }, { name: "XRP", ticker: "XRP" },
  { name: "Cardano", ticker: "ADA" }, { name: "Dogecoin", ticker: "DOGE" },
  { name: "Chainlink", ticker: "LINK" }, { name: "Polkadot", ticker: "DOT" },
  { name: "Avalanche", ticker: "AVAX" }, { name: "Litecoin", ticker: "LTC" },
  { name: "Polygon", ticker: "MATIC" }, { name: "USDC", ticker: "USDC" },
];

function extractJSON(text) {
  if (!text) return null;
  const s = text.indexOf("{");
  if (s === -1) return null;
  let body = text.slice(s);
  try { return JSON.parse(body.slice(0, body.lastIndexOf("}") + 1)); } catch {}
  try {
    let cut = body;
    const lastComma = cut.lastIndexOf(",");
    if (lastComma > 0) cut = cut.slice(0, lastComma);
    const quotes = (cut.match(/"/g) || []).length;
    if (quotes % 2 !== 0) cut += '"';
    const stack = [];
    let inStr = false, esc = false;
    for (const ch of cut) {
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') inStr = !inStr;
      if (inStr) continue;
      if (ch === "{" || ch === "[") stack.push(ch);
      else if (ch === "}" || ch === "]") stack.pop();
    }
    while (stack.length) cut += stack.pop() === "{" ? "}" : "]";
    return JSON.parse(cut);
  } catch { return null; }
}
const fmt = (n) => (typeof n === "number" ? n.toLocaleString() : n);
const slugify = (s) => (s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Results and favorites are cached in the browser so repeat lookups are instant & free.
const CACHE = new Map();
const CK = "plainpaper:";
function cacheGet(k) {
  if (CACHE.has(k)) return CACHE.get(k);
  try { const v = localStorage.getItem(CK + k); if (v) { const o = JSON.parse(v); CACHE.set(k, o); return o; } } catch {}
  return null;
}
function cacheSet(k, v) {
  CACHE.set(k, v);
  try { localStorage.setItem(CK + k, JSON.stringify(v)); } catch {}
}
function loadFavorites() {
  try { return JSON.parse(localStorage.getItem("plainpaper:favs") || "[]"); } catch { return []; }
}
function saveFavorites(n) {
  try { localStorage.setItem("plainpaper:favs", JSON.stringify(n)); } catch {}
}

const BITCOIN_SAMPLE = {
  found: true, interpretedAs: "Bitcoin", name: "Bitcoin", ticker: "BTC",
  category: "Layer 1 blockchain / digital currency", launched: "2009", consensus: "Proof of Work",
  oneLiner: "Digital money you can send to anyone in the world without needing a bank in the middle.",
  analogy: "It's like emailing cash directly to a person — no post office, no bank, just a public ledger everyone can check.",
  purpose: "Bitcoin was created to let people pay each other directly online without trusting a bank or company to approve it. It tries to solve the problem of needing a middleman who can block, reverse, or charge for your payments.",
  steps: [
    { title: "You send a payment", detail: "You broadcast a signed message saying you want to send coins to someone." },
    { title: "Miners verify it", detail: "Computers around the world check the payment is valid and not double-spent." },
    { title: "It's added to a block", detail: "Verified payments are bundled into a 'block' roughly every 10 minutes." },
    { title: "The block is locked in", detail: "Miners compete to seal the block; once sealed it's extremely hard to change." },
    { title: "Everyone updates", detail: "The new block is shared so every copy of the ledger agrees on who owns what." },
  ],
  keyFeatures: ["Fixed 21M supply", "No central authority", "Public ledger", "Borderless"],
  tokenomics: {
    summary: "Bitcoin has a hard cap of 21 million coins, and the rate of new coins halves about every four years.",
    maxSupplyNum: 21000000, circulatingNum: 19700000, supplyText: "21,000,000 max",
    distribution: [{ label: "Mined into circulation", percent: 94 }, { label: "Yet to be mined", percent: 6 }],
  },
  useCases: ["Sending money across borders", "A store of value ('digital gold')", "Payments without a bank"],
  risks: ["Lost keys mean lost coins forever", "Network fees rise when busy", "Slower than card payments"],
  glossary: [
    { term: "Blockchain", def: "A shared digital ledger that records every transaction in linked 'blocks'." },
    { term: "Mining", def: "Using computers to verify transactions and earn new coins as a reward." },
    { term: "Proof of Work", def: "A system where computers solve hard puzzles to secure the network." },
    { term: "Private key", def: "A secret password that proves you own your coins. Lose it and they're gone." },
  ],
  whitepaperUrl: "https://bitcoin.org/bitcoin.pdf",
  sources: [{ title: "bitcoin.org", url: "https://bitcoin.org" }],
};

// Shared fetch (used by main search AND the compare feature).
async function fetchCoin(term, lvl) {
  const key = slugify(term) + "|" + lvl;
  const hit = cacheGet(key);
  if (hit) return hit;
  // Calls YOUR server function (api/explain.js), which safely holds the API key.
  const res = await fetch("/api/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ term, level: lvl }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  const parsed = extractJSON(json.text);
  if (!parsed) throw new Error("Couldn't read the response. Try again, or try the full coin name.");
  if (parsed.found !== false) {
    cacheSet(key, parsed);
    cacheSet(slugify(parsed.interpretedAs || parsed.name) + "|" + lvl, parsed);
  }
  return parsed;
}

export default function Plainpaper() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [level, setLevel] = useState("beginner");
  const [activeTerm, setActiveTerm] = useState(null);
  const [copied, setCopied] = useState(false);
  const [favorites, setFavorites] = useState(loadFavorites());
  const [compareMode, setCompareMode] = useState(false);
  const [compareQuery, setCompareQuery] = useState("");
  const [compareData, setCompareData] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState("");

  useEffect(() => {
    try {
      const slug = window.location.pathname.replace(/^\//, "");
      if (slug && slug !== "index.html") { const t = slug.replace(/-/g, " "); setQuery(t); run(t); }
    } catch {}
  // eslint-disable-next-line
  }, []);

  function syncURL(name) { try { window.history.replaceState(null, "", "/" + slugify(name)); } catch {} }

  function closeCompare() { setCompareMode(false); setCompareData(null); setCompareQuery(""); setCompareError(""); }

  function showSample() {
    setError(""); setLoading(false); setQuery("Bitcoin"); setActiveTerm(null); closeCompare();
    setData(BITCOIN_SAMPLE); syncURL("Bitcoin");
  }

  async function run(q, lvlArg) {
    const term = (q ?? query).trim();
    const lvl = lvlArg ?? level;
    if (!term) return;
    setLoading(true); setError(""); setData(null); closeCompare();
    try {
      const d = await fetchCoin(term, lvl);
      if (d.found === false) setError(d.oneLiner || "That doesn't look like a cryptocurrency. Try a coin name.");
      else {
        setData(d); setActiveTerm(term); syncURL(d.interpretedAs || d.name || term);
        try { document.title = `${d.name} explained — Plainpaper`; } catch {}
      }
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally { setLoading(false); }
  }

  async function doCompare() {
    const term = compareQuery.trim();
    if (!term) return;
    setCompareLoading(true); setCompareError("");
    try {
      const d = await fetchCoin(term, level);
      if (d.found === false) setCompareError(d.oneLiner || "Couldn't find that coin.");
      else setCompareData(d);
    } catch (e) {
      setCompareError(e.message || "Couldn't load that coin.");
    } finally { setCompareLoading(false); }
  }

  function pickLevel(l) { setLevel(l); if (activeTerm) run(activeTerm, l); }

  function copyLink() {
    try {
      const url = window.location.origin + "/" + slugify(data.interpretedAs || data.name);
      navigator.clipboard.writeText(url);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  function toggleFavorite(d) {
    const slug = slugify(d.interpretedAs || d.name);
    setFavorites((prev) => {
      const exists = prev.find((f) => f.slug === slug);
      const next = exists ? prev.filter((f) => f.slug !== slug) : [...prev, { name: d.name, ticker: d.ticker, slug }];
      saveFavorites(next);
      return next;
    });
  }
  const isFav = data && favorites.some((f) => f.slug === slugify(data.interpretedAs || data.name));

  const tk = data?.tokenomics;
  const pct = tk && tk.maxSupplyNum && tk.circulatingNum ? Math.min(100, Math.round((tk.circulatingNum / tk.maxSupplyNum) * 100)) : null;
  const showHome = !data && !loading && !error;

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100%", fontFamily: "system-ui, sans-serif" }}>
      <div className="max-w-4xl mx-auto px-5 py-8">
        <header className="mb-7">
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => { setData(null); setError(""); setQuery(""); closeCompare(); try { window.history.replaceState(null, "", "/"); } catch {} }}
              style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.mint})`, width: 30, height: 30, borderRadius: 8 }} title="Home" />
            <span style={{ fontFamily: MONO, color: C.muted, letterSpacing: "0.18em" }} className="text-xs uppercase">crypto, decoded</span>
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight" style={{ background: `linear-gradient(135deg, ${C.text}, ${C.accent})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Plainpaper
          </h1>
          <p style={{ color: C.muted }} className="mt-3 text-lg max-w-xl">
            Search any coin. Get the whole whitepaper translated into something a human can actually read.
          </p>
        </header>

        <div style={{ background: C.panel, borderColor: C.line, boxShadow: `0 0 40px -20px ${C.accent}` }} className="border rounded-2xl p-2.5 flex gap-2 items-center">
          <span style={{ color: C.muted, fontFamily: MONO }} className="pl-2 text-lg">{">"}</span>
          <input
            value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="search a coin — bitcoin, ETH, solana..."
            style={{ color: C.text, fontFamily: MONO }} className="flex-1 bg-transparent outline-none px-1 py-2 text-base"
          />
          <button onClick={() => run()} disabled={loading}
            style={{ background: loading ? C.line : `linear-gradient(135deg, ${C.accent}, ${C.violet})`, color: "#0A0D14" }}
            className="rounded-xl px-6 py-2.5 font-bold transition-all">
            {loading ? "reading…" : "Decode"}
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span style={{ color: C.muted, fontFamily: MONO }} className="text-[10px] uppercase tracking-wider">Reading level:</span>
          <div style={{ background: C.panel2, borderColor: C.line }} className="border rounded-lg p-0.5 flex gap-0.5">
            {Object.keys(LEVELS).map((l) => (
              <button key={l} onClick={() => pickLevel(l)}
                style={{ background: level === l ? C.accent : "transparent", color: level === l ? C.bg : C.muted }}
                className="text-xs rounded-md px-2.5 py-1 font-semibold transition-colors">{LEVELS[l].label}</button>
            ))}
          </div>
        </div>

        {/* HOME: favorites + popular gallery */}
        {showHome && (
          <div className="mt-8">
            <button onClick={showSample} style={{ background: C.mint, color: C.bg, fontFamily: MONO }} className="text-xs rounded-lg px-3 py-1.5 font-bold hover:opacity-80 mb-6">★ See a sample</button>
            {favorites.length > 0 && (
              <div className="mb-6">
                <Label color={C.amber}>Your favorites</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {favorites.map((f) => (
                    <button key={f.slug} onClick={() => { setQuery(f.name); run(f.name); }}
                      style={{ background: C.panel, borderColor: C.amber, color: C.text }}
                      className="border rounded-lg px-3 py-1.5 text-sm hover:opacity-80">★ {f.ticker || f.name}</button>
                  ))}
                </div>
              </div>
            )}
            <Label color={C.muted}>Popular coins — tap to explore</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
              {POPULAR.map((c) => (
                <button key={c.ticker} onClick={() => { setQuery(c.name); run(c.name); }}
                  style={{ background: C.panel, borderColor: C.line }}
                  className="border rounded-xl p-3 text-left hover:opacity-80 transition-opacity">
                  <div style={{ color: C.accent, fontFamily: MONO }} className="text-xs font-bold">${c.ticker}</div>
                  <div className="font-semibold text-sm mt-0.5">{c.name}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="mt-12 text-center">
            <div style={{ borderColor: C.line, borderTopColor: C.accent }} className="mx-auto mb-4 w-8 h-8 border-2 rounded-full animate-spin" />
            <div style={{ color: C.text }} className="text-lg">Finding and reading the whitepaper…</div>
            <div style={{ color: C.muted }} className="text-sm mt-1">Usually 10–20 seconds.</div>
          </div>
        )}

        {error && !loading && (
          <div style={{ background: "#2A1518", borderColor: "#5A2A2E", color: C.red }} className="mt-6 border rounded-xl p-4">
            <div>{error}</div>
            <button onClick={showSample} style={{ color: C.mint }} className="text-sm underline mt-2">See a sample result instead →</button>
          </div>
        )}

        {data && !loading && (
          <article className="mt-9">
            {data.interpretedAs && data.interpretedAs.toLowerCase() !== query.trim().toLowerCase() && (
              <div style={{ color: C.muted, fontFamily: MONO }} className="text-xs mb-3">
                showing results for <span style={{ color: C.mint }}>{data.interpretedAs}</span>
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-4xl font-extrabold">{data.name}</h2>
              {data.ticker && <span style={{ background: C.panel, borderColor: C.accent, color: C.accent, fontFamily: MONO }} className="border text-sm font-bold rounded-lg px-2.5 py-1">${data.ticker}</span>}
            </div>
            {data.oneLiner && <p className="text-xl mt-3 leading-relaxed" style={{ color: C.text }}>{data.oneLiner}</p>}

            {/* Action bar */}
            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={() => toggleFavorite(data)} style={{ borderColor: isFav ? C.amber : C.line, color: isFav ? C.amber : C.muted }} className="border rounded-lg px-3 py-1.5 text-xs hover:opacity-80">{isFav ? "★ Saved" : "☆ Save"}</button>
              <button onClick={copyLink} style={{ borderColor: C.line, color: copied ? C.mint : C.muted }} className="border rounded-lg px-3 py-1.5 text-xs hover:opacity-80">{copied ? "✓ Link copied" : "🔗 Copy link"}</button>
              {!compareMode && <button onClick={() => setCompareMode(true)} style={{ borderColor: C.line, color: C.violet }} className="border rounded-lg px-3 py-1.5 text-xs hover:opacity-80">⇄ Compare</button>}
            </div>

            {/* Compare input */}
            {compareMode && (
              <div style={{ background: C.panel, borderColor: C.line }} className="border rounded-xl p-2.5 mt-3 flex gap-2 items-center flex-wrap">
                <span style={{ color: C.violet, fontFamily: MONO }} className="text-xs">vs</span>
                <input value={compareQuery} onChange={(e) => setCompareQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doCompare()}
                  placeholder="compare with another coin…" style={{ color: C.text, fontFamily: MONO }} className="flex-1 bg-transparent outline-none px-1 py-1 text-sm min-w-[140px]" />
                <button onClick={doCompare} disabled={compareLoading} style={{ background: C.violet, color: C.bg }} className="rounded-lg px-4 py-1.5 text-sm font-bold">{compareLoading ? "…" : "Compare"}</button>
                <button onClick={closeCompare} style={{ color: C.muted }} className="px-2 text-sm">×</button>
              </div>
            )}
            {compareError && <div style={{ color: C.red }} className="text-sm mt-2">{compareError}</div>}
            {compareData && <CompareView a={data} b={compareData} />}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              <Stat label="Category" value={data.category} />
              <Stat label="Launched" value={data.launched} mono />
              <Stat label="Consensus" value={data.consensus} />
              <Stat label="Supply" value={tk?.supplyText} mono />
            </div>

            {data.analogy && (
              <div style={{ background: C.panel, borderColor: C.line }} className="border rounded-2xl p-5 mt-6">
                <Label color={C.mint}>Think of it like</Label>
                <p className="text-lg leading-relaxed mt-1">{data.analogy}</p>
              </div>
            )}

            <WhatItDoes data={data} />

            <Section title="Why it exists" body={data.purpose} />

            {Array.isArray(data.steps) && data.steps.length > 0 && (
              <div className="mt-7">
                <Label color={C.accent}>How it works</Label>
                <div className="mt-3 relative pl-7">
                  <div style={{ background: C.line }} className="absolute left-[10px] top-1 bottom-1 w-px" />
                  {data.steps.map((s, i) => (
                    <div key={i} className="relative mb-4">
                      <span style={{ background: C.accent, color: C.bg, fontFamily: MONO }} className="absolute -left-7 top-0 w-[21px] h-[21px] rounded-full text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <div className="font-semibold">{s.title}</div>
                      <div style={{ color: C.muted }} className="text-sm leading-relaxed">{s.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ChipSection title="Key features" items={data.keyFeatures} color={C.violet} />

            {tk && (
              <div className="mt-7">
                <Label color={C.amber}>Tokenomics</Label>
                {tk.summary && <p className="leading-relaxed mt-1 mb-3">{tk.summary}</p>}
                {pct !== null && (
                  <div className="mb-4">
                    <div style={{ color: C.muted, fontFamily: MONO }} className="flex justify-between text-xs mb-1">
                      <span>circulating {fmt(tk.circulatingNum)}</span><span>max {fmt(tk.maxSupplyNum)}</span>
                    </div>
                    <div style={{ background: C.line }} className="h-2.5 rounded-full overflow-hidden">
                      <div style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${C.accent}, ${C.mint})`, height: "100%" }} />
                    </div>
                    <div style={{ color: C.muted }} className="text-xs mt-1">{pct}% of max supply in circulation</div>
                  </div>
                )}
                {Array.isArray(tk.distribution) && tk.distribution.length > 0 && (
                  <div style={{ background: C.panel, borderColor: C.line }} className="border rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
                    <div style={{ width: 170, height: 170 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={tk.distribution} dataKey="percent" nameKey="label" innerRadius={42} outerRadius={78} paddingAngle={2} stroke="none">
                            {tk.distribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, color: C.text }} formatter={(v, n) => [`${v}%`, n]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 w-full">
                      {tk.distribution.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 py-1">
                          <span style={{ background: CHART_COLORS[i % CHART_COLORS.length], width: 11, height: 11, borderRadius: 3 }} />
                          <span className="text-sm flex-1">{d.label}</span>
                          <span style={{ fontFamily: MONO }} className="text-sm font-semibold">{d.percent}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <ListSection title="What it's used for" items={data.useCases} color={C.mint} />
            <ListSection title="Things to be aware of" items={data.risks} color={C.red} />

            {Array.isArray(data.glossary) && data.glossary.length > 0 && (
              <div className="mt-7">
                <Label color={C.muted}>Jargon, explained</Label>
                <div className="grid sm:grid-cols-2 gap-3 mt-2">
                  {data.glossary.map((g, i) => (
                    <div key={i} style={{ background: C.panel2, borderColor: C.line }} className="border rounded-xl p-3">
                      <div style={{ color: C.accent, fontFamily: MONO }} className="text-sm font-semibold">{g.term}</div>
                      <div style={{ color: C.muted }} className="text-sm leading-relaxed mt-0.5">{g.def}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.sources?.length > 0 && (
              <div className="mt-7">
                <Label color={C.muted}>Other sources</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {data.sources.map((s, i) => <Source key={i} href={s.url} title={s.title || s.url} />)}
                </div>
              </div>
            )}

            <a
              href={data.whitepaperUrl || `https://www.google.com/search?q=${encodeURIComponent((data.name || query) + " cryptocurrency official whitepaper")}`}
              target="_blank" rel="noreferrer"
              style={{ borderColor: C.accent, background: C.panel, boxShadow: `0 0 40px -22px ${C.accent}` }}
              className="mt-8 flex items-center justify-between border rounded-2xl px-5 py-4 hover:opacity-80 transition-opacity">
              <div>
                <div style={{ color: C.accent, fontFamily: MONO }} className="text-[10px] uppercase tracking-widest">
                  {data.whitepaperUrl ? "The source document" : "Find the source"}
                </div>
                <div className="text-lg font-bold mt-0.5">
                  {data.whitepaperUrl ? `Read the official ${data.name} whitepaper` : `Search for the ${data.name || "coin"} whitepaper`}
                </div>
              </div>
              <span style={{ color: C.accent }} className="text-2xl">↗</span>
            </a>
          </article>
        )}

        <footer style={{ borderColor: C.line, color: C.muted }} className="border-t mt-14 pt-4 text-xs">
          AI-generated educational summaries from public sources. Not financial advice. Verify against the official whitepaper.
        </footer>
      </div>
    </div>
  );
}

function Label({ children, color }) {
  return <div style={{ color, fontFamily: MONO }} className="text-xs font-semibold uppercase tracking-widest">{children}</div>;
}
function Stat({ label, value, mono }) {
  if (!value) return null;
  return (
    <div style={{ background: C.panel2, borderColor: C.line }} className="border rounded-xl p-3">
      <div style={{ color: C.muted, fontFamily: MONO }} className="text-[10px] uppercase tracking-wider">{label}</div>
      <div style={{ fontFamily: mono ? MONO : "inherit" }} className="text-sm font-semibold mt-1 leading-snug">{value}</div>
    </div>
  );
}
function Section({ title, body }) {
  if (!body) return null;
  return <div className="mt-7"><Label color={C.accent}>{title}</Label><p className="leading-relaxed mt-1">{body}</p></div>;
}
function ListSection({ title, items, color }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div className="mt-7">
      <Label color={color}>{title}</Label>
      <ul className="space-y-1.5 mt-2">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 leading-relaxed"><span style={{ color }} className="font-bold">→</span><span>{it}</span></li>
        ))}
      </ul>
    </div>
  );
}
function ChipSection({ title, items, color }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div className="mt-7">
      <Label color={color}>{title}</Label>
      <div className="flex flex-wrap gap-2 mt-2">
        {items.map((it, i) => (
          <span key={i} style={{ background: C.panel, borderColor: C.line }} className="border rounded-lg px-3 py-1.5 text-sm">{it}</span>
        ))}
      </div>
    </div>
  );
}
function Source({ href, title }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{ background: C.panel, borderColor: C.line, color: C.text }}
      className="border rounded-lg px-3 py-1.5 text-sm hover:opacity-70">{title} ↗</a>
  );
}
function WhatItDoes({ data }) {
  const uses = (Array.isArray(data.useCases) ? data.useCases : []).slice(0, 5);
  if (uses.length === 0) return null;
  const cx = 240, cy = 160, rx = 150, ry = 112;
  const pts = uses.map((u, i) => {
    const theta = (2 * Math.PI / uses.length) * i - Math.PI / 2;
    return { u, x: cx + rx * Math.cos(theta), y: cy + ry * Math.sin(theta) };
  });
  const center = data.ticker || (data.name || "").slice(0, 4).toUpperCase();
  return (
    <div className="mt-6">
      <Label color={C.mint}>What {data.ticker ? "$" + data.ticker : data.name} lets you do</Label>
      <div style={{ background: C.panel, borderColor: C.line }} className="border rounded-2xl p-2 mt-2">
        <svg viewBox="0 0 480 320" className="w-full" style={{ maxHeight: 380 }}>
          <defs>
            <linearGradient id="hubGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={C.accent} />
              <stop offset="100%" stopColor={C.mint} />
            </linearGradient>
          </defs>
          {pts.map((p, i) => (<line key={"l" + i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={C.line} strokeWidth="2" />))}
          {pts.map((p, i) => (
            <foreignObject key={"f" + i} x={p.x - 70} y={p.y - 27} width="140" height="54">
              <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, color: C.text, fontSize: 11, lineHeight: 1.2, padding: "6px 8px", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" }}>
                {p.u}
              </div>
            </foreignObject>
          ))}
          <circle cx={cx} cy={cy} r="50" fill="url(#hubGrad)" />
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontFamily={MONO} fontWeight="800" fontSize={center.length > 4 ? 14 : 18} fill={C.bg}>{center}</text>
        </svg>
      </div>
      <div style={{ color: C.muted }} className="text-xs mt-1 text-center">{data.name} sits at the center — each branch is something it enables.</div>
    </div>
  );
}
function CompareView({ a, b }) {
  const rows = [
    ["In one line", a.oneLiner, b.oneLiner],
    ["Category", a.category, b.category],
    ["Launched", a.launched, b.launched],
    ["Consensus", a.consensus, b.consensus],
    ["Max supply", a.tokenomics?.supplyText, b.tokenomics?.supplyText],
  ];
  return (
    <div className="mt-4 mb-2">
      <Label color={C.violet}>Side-by-side</Label>
      <div style={{ background: C.panel, borderColor: C.line }} className="border rounded-2xl overflow-hidden mt-2">
        <div className="grid grid-cols-2">
          <div className="p-3 font-bold">{a.name} {a.ticker && <span style={{ color: C.accent, fontFamily: MONO }} className="text-xs">${a.ticker}</span>}</div>
          <div className="p-3 font-bold" style={{ borderLeft: `1px solid ${C.line}` }}>{b.name} {b.ticker && <span style={{ color: C.mint, fontFamily: MONO }} className="text-xs">${b.ticker}</span>}</div>
        </div>
        {rows.map(([label, va, vb], i) => (
          <div key={i}>
            <div style={{ color: C.muted, fontFamily: MONO, background: C.panel2 }} className="text-[10px] uppercase tracking-wider px-3 py-1">{label}</div>
            <div className="grid grid-cols-2">
              <div className="p-3 text-sm">{va || "—"}</div>
              <div className="p-3 text-sm" style={{ borderLeft: `1px solid ${C.line}` }}>{vb || "—"}</div>
            </div>
          </div>
        ))}
        <CompareLists label="Used for" a={a.useCases} b={b.useCases} />
        <CompareLists label="Watch out for" a={a.risks} b={b.risks} />
      </div>
    </div>
  );
}
function CompareLists({ label, a, b }) {
  return (
    <div>
      <div style={{ color: C.muted, fontFamily: MONO, background: C.panel2 }} className="text-[10px] uppercase tracking-wider px-3 py-1">{label}</div>
      <div className="grid grid-cols-2">
        <ul className="p-3 text-sm space-y-1">{(a || []).map((x, i) => <li key={i}>• {x}</li>)}</ul>
        <ul className="p-3 text-sm space-y-1" style={{ borderLeft: `1px solid ${C.line}` }}>{(b || []).map((x, i) => <li key={i}>• {x}</li>)}</ul>
      </div>
    </div>
  );
}
