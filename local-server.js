require("dotenv").config();

const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  MODEL_PRICING_PER_1M,
  PROVIDERS,
  normalizeBaseUrl,
  extractRemainingUsd,
  estimateRemainingTokens,
  summarizeUsability,
  runCheck,
  runChatCheck
} = require("./lib/checker");
const {
  SUPABASE_TABLE,
  isSupabaseConfigured,
  listRecentChecks,
  saveCheckRecord
} = require("./lib/supabase");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const STATIC_DIR = path.join(__dirname, "public");

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

async function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8"
  };

  try {
    const content = await fs.promises.readFile(filePath);
    res.writeHead(200, { "Content-Type": contentTypes[ext] || "text/plain; charset=utf-8" });
    res.end(content);
  } catch {
    sendJson(res, 404, { error: "File not found." });
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function handleRequest(req, res) {
  try {
    const reqUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && reqUrl.pathname === "/api/providers") {
      sendJson(res, 200, {
        providers: Object.entries(PROVIDERS).map(([id, config]) => ({
          id,
          label: config.label,
          defaultBaseUrl: config.defaultBaseUrl
        })),
        supportedPricingModels: MODEL_PRICING_PER_1M,
        storage: {
          supabaseConfigured: isSupabaseConfigured(),
          table: SUPABASE_TABLE
        }
      });
      return;
    }

    if (req.method === "GET" && reqUrl.pathname === "/api/history") {
      if (!isSupabaseConfigured()) {
        sendJson(res, 200, {
          enabled: false,
          table: SUPABASE_TABLE,
          items: []
        });
        return;
      }

      const items = await listRecentChecks(Number(reqUrl.searchParams.get("limit")) || 12);
      sendJson(res, 200, {
        enabled: true,
        table: SUPABASE_TABLE,
        items
      });
      return;
    }

    if (req.method === "POST" && reqUrl.pathname === "/api/check") {
      const rawBody = await readRequestBody(req);
      const body = rawBody ? JSON.parse(rawBody) : {};
      const provider = String(body.provider || "openai");
      const apiKey = String(body.apiKey || "").trim();
      const baseUrl = String(body.baseUrl || "").trim() || PROVIDERS[provider]?.defaultBaseUrl;
      const model = String(body.model || "").trim();

      if (!apiKey) {
        sendJson(res, 400, { error: "API key is required." });
        return;
      }

      const result = await runCheck({ provider, apiKey, baseUrl, model });
      const saveState = await saveCheckRecord({
        checkType: "check",
        provider,
        baseUrl,
        model,
        apiKey,
        result
      }).catch((error) => ({
        saved: false,
        configured: true,
        error: error.message
      }));

      sendJson(res, 200, {
        ...result,
        storage: saveState
      });
      return;
    }

    if (req.method === "POST" && reqUrl.pathname === "/api/chat-check") {
      const rawBody = await readRequestBody(req);
      const body = rawBody ? JSON.parse(rawBody) : {};
      const provider = String(body.provider || "openai");
      const apiKey = String(body.apiKey || "").trim();
      const baseUrl = String(body.baseUrl || "").trim() || PROVIDERS[provider]?.defaultBaseUrl;
      const model = String(body.model || "").trim();

      if (!apiKey) {
        sendJson(res, 400, { error: "API key is required." });
        return;
      }

      const result = await runChatCheck({ provider, apiKey, baseUrl, model });
      const saveState = await saveCheckRecord({
        checkType: "chat-check",
        provider,
        baseUrl,
        model,
        apiKey,
        result
      }).catch((error) => ({
        saved: false,
        configured: true,
        error: error.message
      }));

      sendJson(res, 200, {
        ...result,
        storage: saveState
      });
      return;
    }

    if (req.method === "GET") {
      const requested = reqUrl.pathname === "/" ? "/index.html" : reqUrl.pathname;
      const filePath = path.join(STATIC_DIR, requested);
      if (!filePath.startsWith(STATIC_DIR)) {
        sendJson(res, 403, { error: "Forbidden." });
        return;
      }

      await sendFile(res, filePath);
      return;
    }

    sendJson(res, 404, { error: "Not found." });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Unexpected server error." });
  }
}

function createServer() {
  return http.createServer(handleRequest);
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`AI API key checker running at http://${HOST}:${PORT}`);
  });
}

module.exports = {
  createServer,
  handleRequest,
  MODEL_PRICING_PER_1M,
  PROVIDERS,
  normalizeBaseUrl,
  extractRemainingUsd,
  estimateRemainingTokens,
  summarizeUsability,
  runCheck,
  runChatCheck
};
