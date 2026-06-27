const { SUPABASE_TABLE, isSupabaseConfigured, listRecentChecks } = require("../lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Method not allowed." }, null, 2));
    return;
  }

  try {
    if (!isSupabaseConfigured()) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify(
          {
            enabled: false,
            table: SUPABASE_TABLE,
            items: []
          },
          null,
          2
        )
      );
      return;
    }

    const items = await listRecentChecks(Number(req.query?.limit) || 12);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify(
        {
          enabled: true,
          table: SUPABASE_TABLE,
          items
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
