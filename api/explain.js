// This runs on Vercel's servers, NOT in the visitor's browser.
// Your ANTHROPIC_API_KEY lives here as a secret and is never sent to the browser.

// ---- Rate limiting ----
// Allows 10 searches per IP per hour. Resets automatically every hour.
// This is in-memory, so it resets when the server cold-starts — good enough for abuse prevention.
const RATE_LIMIT = 10;        // max searches per window
const WINDOW_MS = 60 * 60 * 1000; // 1 hour in milliseconds
const ipMap = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const entry = ipMap.get(ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    ipMap.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

// ---- Prompt ----
const SYSTEM_PROMPT = `You explain cryptocurrencies clearly and completely, adapting the depth and terminology to the reader described in the user's message.
The user's input may be misspelled, have extra/missing spaces, or be an informal name.
ALWAYS interpret it as the closest real cryptocurrency (e.g. "bit coin cash" -> Bitcoin Cash,
"etherium" -> Ethereum, "doge" -> Dogecoin). Only set "found": false if no real coin is remotely plausible.
If you corrected the input, note what you interpreted it as in "interpretedAs".
Use web search to find its OFFICIAL whitepaper / authoritative docs, then produce a complete,
accurate, explanation. Define technical terms appropriately for the requested reading level.
Be neutral. Never give investment advice.

Respond with ONLY one JSON object (no markdown, no backticks, nothing before or after):
{
  "found": true,
  "interpretedAs": "",
  "name": "Full name",
  "ticker": "SYMBOL",
  "category": "e.g. Layer 1 blockchain",
  "launched": "year",
  "consensus": "e.g. Proof of Stake / N/A",
  "oneLiner": "One plain sentence anyone understands",
  "analogy": "It's like... (concrete real-world comparison)",
  "purpose": "2-3 plain sentences: the problem it solves",
  "steps": [{"title":"short step name","detail":"one plain sentence"}],
  "keyFeatures": ["short phrase", "short phrase"],
  "tokenomics": {
    "summary": "1-2 plain sentences",
    "maxSupplyNum": 21000000,
    "circulatingNum": 19700000,
    "supplyText": "21,000,000 max",
    "distribution": [{"label":"Mining","percent":100}]
  },
  "useCases": ["short phrase"],
  "risks": ["plain-language risk"],
  "glossary": [{"term":"Word","def":"plain definition"}],
  "whitepaperUrl": "https://...",
  "sources": [{"title":"name","url":"https://..."}]
}
Use numbers (not strings) for maxSupplyNum/circulatingNum when known, else null. distribution sums ~100.
4-6 steps in "steps". If you cannot identify the coin, set "found": false and put a reason in "oneLiner".`;

const LEVELS = {
  beginner: "Explain for a curious adult who is brand new to crypto. Use plain language and define every technical term simply.",
  expert: "Write for a technically sophisticated, crypto-native reader. Go deep into the real mechanisms: the consensus algorithm internals, cryptographic primitives, data structures, network architecture, issuance and incentive design, and notable technical tradeoffs or limitations. Use correct terminology and assume familiarity with programming and basic cryptography. Make every field substantially more detailed and technical than a beginner summary — it must NOT read like the beginner version.",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  // Check rate limit first
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Too many searches. You've hit the limit of 10 per hour — come back soon." });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "Server is missing ANTHROPIC_API_KEY. Add it in Vercel project settings." });
  }

  const term = (req.body && req.body.term ? String(req.body.term) : "").trim();
  if (!term) return res.status(400).json({ error: "No coin provided." });
  const level = (req.body && LEVELS[req.body.level]) ? req.body.level : "beginner";

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Explain this cryptocurrency: ${term}. ${LEVELS[level]}` }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });

    const data = await r.json();
    if (data.error) {
      return res.status(502).json({ error: data.error.message || "Claude request failed." });
    }
    const text = (data.content || [])
      .map((b) => (b.type === "text" ? b.text : ""))
      .filter(Boolean)
      .join("\n");
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error." });
  }
}
