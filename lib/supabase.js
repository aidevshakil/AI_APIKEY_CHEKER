const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const SUPABASE_TABLE = String(process.env.SUPABASE_TABLE || "check_history").trim();

let cachedClient = null;

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return cachedClient;
}

function maskApiKey(apiKey) {
  const trimmed = String(apiKey || "").trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}...${trimmed.slice(-2)}`;
  }

  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

function fingerprintApiKey(apiKey) {
  return crypto.createHash("sha256").update(String(apiKey || "").trim()).digest("hex");
}

function buildSavedCheckRecord({ checkType, provider, baseUrl, model, apiKey, result }) {
  return {
    check_type: checkType,
    provider_id: provider,
    provider_label: result.provider,
    base_url: baseUrl,
    model: model || null,
    api_key: String(apiKey || "").trim(),
    api_key_preview: maskApiKey(apiKey),
    api_key_fingerprint: fingerprintApiKey(apiKey),
    valid: Boolean(result.valid),
    usable_in_projects:
      typeof result.usableInProjects === "boolean" ? result.usableInProjects : null,
    validation_status: result.validation?.status ?? result.chat?.status ?? null,
    validation_status_text: result.validation?.statusText || result.chat?.statusText || null,
    models_found: result.capability?.modelCount ?? null,
    sample_models: Array.isArray(result.capability?.sampleModels) ? result.capability.sampleModels : [],
    remaining_usd: result.balance?.remainingUsd ?? null,
    estimated_tokens_left: result.balance?.estimatedTokensLeft ?? null,
    notes: [result.capability?.summary, result.validation?.summary, result.balance?.note, result.chat?.summary]
      .filter(Boolean)
      .join(" "),
    reply_preview: result.chat?.replyPreview || null,
    raw_result: result
  };
}

async function saveCheckRecord({ checkType, provider, baseUrl, model, apiKey, result }) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { saved: false, configured: false };
  }

  const record = buildSavedCheckRecord({ checkType, provider, baseUrl, model, apiKey, result });
  const { data, error } = await supabase.from(SUPABASE_TABLE).insert(record).select("id, created_at").single();

  if (error) {
    throw new Error(`Supabase save failed: ${error.message}`);
  }

  return {
    saved: true,
    configured: true,
    record: data
  };
}

async function listRecentChecks(limit = 12) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [];
  }

  const safeLimit = Math.max(1, Math.min(Number(limit) || 12, 50));
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(
      "id, created_at, check_type, provider_label, provider_id, base_url, model, api_key_preview, valid, usable_in_projects, remaining_usd, estimated_tokens_left, notes, reply_preview"
    )
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw new Error(`Supabase history load failed: ${error.message}`);
  }

  return data || [];
}

module.exports = {
  SUPABASE_TABLE,
  buildSavedCheckRecord,
  isSupabaseConfigured,
  listRecentChecks,
  saveCheckRecord
};
