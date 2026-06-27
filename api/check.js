const { PROVIDERS, runCheck } = require("../lib/checker");
const { saveCheckRecord } = require("../lib/supabase");

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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Method not allowed." }, null, 2));
    return;
  }

  try {
    const rawBody = await readRequestBody(req);
    const body = rawBody ? JSON.parse(rawBody) : {};
    const provider = String(body.provider || "openai");
    const apiKey = String(body.apiKey || "").trim();
    const baseUrl = String(body.baseUrl || "").trim() || PROVIDERS[provider]?.defaultBaseUrl;
    const model = String(body.model || "").trim();

    if (!apiKey) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "API key is required." }, null, 2));
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

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify(
        {
          ...result,
          storage: saveState
        },
        null,
        2
      )
    );
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: error.message || "Unexpected server error." }, null, 2));
  }
};
