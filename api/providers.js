const { MODEL_PRICING_PER_1M, PROVIDERS } = require("../lib/checker");
const { SUPABASE_TABLE, isSupabaseConfigured } = require("../lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Method not allowed." }, null, 2));
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(
    JSON.stringify(
      {
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
      },
      null,
      2
    )
  );
};
