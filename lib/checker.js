const { URL } = require("url");

const MODEL_PRICING_PER_1M = {
  "gpt-4.1": 2.0,
  "gpt-4.1-mini": 0.4,
  "gpt-4.1-nano": 0.1,
  "gpt-4o": 2.5,
  "gpt-4o-mini": 0.15,
  "gpt-3.5-turbo": 0.5,
  "claude-sonnet-4-20250514": 3.0,
  "claude-opus-4-20250514": 15.0,
  "gemini-2.5-flash": 0.3,
  "gemini-2.5-pro": 1.25,
  "grok-4": 3.0,
  "grok-3-mini": 0.3,
  "deepseek-v4-flash": 0.27,
  "deepseek-v4-pro": 2.68,
  "deepseek-chat": 0.27,
  "deepseek-reasoner": 2.68
};

const DEFAULT_CHAT_MODELS = {
  openai: "gpt-4.1-mini",
  anthropic: "claude-sonnet-4-20250514",
  gemini: "gemini-2.5-flash",
  xai: "grok-3-mini",
  deepseek: "deepseek-chat"
};

const PROVIDERS = {
  openai: {
    label: "OpenAI / GPT",
    defaultBaseUrl: "https://api.openai.com/v1",
    makeHeaders(apiKey) {
      return {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      };
    },
    validateUrl(baseUrl) {
      return new URL("models", normalizeBaseUrl(baseUrl)).toString();
    },
    candidateBalanceUrls(baseUrl) {
      const normalized = normalizeBaseUrl(baseUrl);
      const origin = new URL(normalized).origin;
      return [
        new URL("dashboard/billing/credit_grants", `${origin}/`).toString(),
        new URL("dashboard/billing/subscription", `${origin}/`).toString(),
        new URL("credits", normalized).toString(),
        new URL("usage", normalized).toString()
      ];
    },
    extractModels(data) {
      return Array.isArray(data?.data) ? data.data : [];
    },
    buildChatRequest(baseUrl, apiKey, model) {
      return {
        url: new URL("chat/completions", normalizeBaseUrl(baseUrl)).toString(),
        options: {
          method: "POST",
          headers: this.makeHeaders(apiKey),
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: "Reply with OK" }],
            max_tokens: 10
          })
        }
      };
    },
    summarizeChatResponse(data) {
      return data?.choices?.[0]?.message?.content || "Chat response received.";
    }
  },
  anthropic: {
    label: "Anthropic / Claude",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    makeHeaders(apiKey) {
      return {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      };
    },
    validateUrl(baseUrl) {
      return new URL("models", normalizeBaseUrl(baseUrl)).toString();
    },
    candidateBalanceUrls(baseUrl) {
      const normalized = normalizeBaseUrl(baseUrl);
      return [new URL("usage", normalized).toString(), new URL("credits", normalized).toString()];
    },
    extractModels(data) {
      return Array.isArray(data?.data) ? data.data : [];
    },
    buildChatRequest(baseUrl, apiKey, model) {
      return {
        url: new URL("messages", normalizeBaseUrl(baseUrl)).toString(),
        options: {
          method: "POST",
          headers: this.makeHeaders(apiKey),
          body: JSON.stringify({
            model,
            max_tokens: 16,
            messages: [{ role: "user", content: "Reply with OK" }]
          })
        }
      };
    },
    summarizeChatResponse(data) {
      const text = Array.isArray(data?.content)
        ? data.content
            .filter((entry) => entry?.type === "text")
            .map((entry) => entry.text)
            .join(" ")
        : "";
      return text || "Chat response received.";
    }
  },
  gemini: {
    label: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    makeHeaders() {
      return { "Content-Type": "application/json" };
    },
    validateUrl(baseUrl, apiKey) {
      const url = new URL("models", normalizeBaseUrl(baseUrl));
      url.searchParams.set("key", apiKey);
      return url.toString();
    },
    candidateBalanceUrls() {
      return [];
    },
    extractModels(data) {
      return Array.isArray(data?.models) ? data.models : [];
    },
    buildChatRequest(baseUrl, apiKey, model) {
      const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
      const url = new URL(`models/${model}:generateContent`, normalizedBaseUrl);
      url.searchParams.set("key", apiKey);
      return {
        url: url.toString(),
        options: {
          method: "POST",
          headers: this.makeHeaders(apiKey),
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Reply with OK" }] }],
            generationConfig: { maxOutputTokens: 16 }
          })
        }
      };
    },
    summarizeChatResponse(data) {
      return (
        data?.candidates?.[0]?.content?.parts
          ?.map((part) => part?.text)
          .filter(Boolean)
          .join(" ") || "Chat response received."
      );
    }
  },
  xai: {
    label: "xAI / Grok",
    defaultBaseUrl: "https://api.x.ai/v1",
    makeHeaders(apiKey) {
      return {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      };
    },
    validateUrl(baseUrl) {
      return new URL("models", normalizeBaseUrl(baseUrl)).toString();
    },
    candidateBalanceUrls(baseUrl) {
      const normalized = normalizeBaseUrl(baseUrl);
      return [new URL("usage", normalized).toString(), new URL("credits", normalized).toString()];
    },
    extractModels(data) {
      return Array.isArray(data?.data) ? data.data : [];
    },
    buildChatRequest(baseUrl, apiKey, model) {
      return {
        url: new URL("chat/completions", normalizeBaseUrl(baseUrl)).toString(),
        options: {
          method: "POST",
          headers: this.makeHeaders(apiKey),
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: "Reply with OK" }],
            max_tokens: 10
          })
        }
      };
    },
    summarizeChatResponse(data) {
      return data?.choices?.[0]?.message?.content || "Chat response received.";
    }
  },
  deepseek: {
    label: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com",
    makeHeaders(apiKey) {
      return {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      };
    },
    validateUrl(baseUrl) {
      return new URL("models", normalizeBaseUrl(baseUrl)).toString();
    },
    candidateBalanceUrls(baseUrl) {
      const normalized = normalizeBaseUrl(baseUrl);
      return [
        new URL("user/balance", normalized).toString(),
        new URL("credits", normalized).toString(),
        new URL("usage", normalized).toString()
      ];
    },
    extractModels(data) {
      return Array.isArray(data?.data) ? data.data : [];
    },
    buildChatRequest(baseUrl, apiKey, model) {
      return {
        url: new URL("chat/completions", normalizeBaseUrl(baseUrl)).toString(),
        options: {
          method: "POST",
          headers: this.makeHeaders(apiKey),
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: "Reply with OK" }],
            max_tokens: 10
          })
        }
      };
    },
    summarizeChatResponse(data) {
      return data?.choices?.[0]?.message?.content || "Chat response received.";
    }
  }
};

function normalizeBaseUrl(baseUrl) {
  const trimmed = String(baseUrl || "").trim();
  if (!trimmed) {
    throw new Error("Base URL is required.");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.endsWith("/") ? withProtocol : `${withProtocol}/`;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    url,
    data
  };
}

function summarizeValidation(payload) {
  if (payload.ok) {
    return "API key accepted by validation endpoint.";
  }

  return payload?.data?.error?.message || payload?.data?.message || payload?.data?.error || "Validation request failed.";
}

function extractRemainingUsd(balanceData) {
  if (!balanceData || typeof balanceData !== "object") {
    return null;
  }

  const deepSeekBalance = balanceData.balance_infos?.find((entry) => entry?.currency === "USD");
  if (deepSeekBalance) {
    const totalBalance = Number(deepSeekBalance.total_balance);
    if (Number.isFinite(totalBalance)) {
      return totalBalance;
    }
  }

  const candidates = [
    balanceData.total_available,
    balanceData.available_credit,
    balanceData.remaining_balance,
    balanceData.balance,
    balanceData.credits?.remaining,
    balanceData.credit?.remaining,
    balanceData.data?.total_available,
    balanceData.data?.available_credit,
    balanceData.data?.remaining_balance,
    balanceData.data?.balance
  ];

  for (const candidate of candidates) {
    const value = typeof candidate === "string" ? Number(candidate) : candidate;
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  const limit = Number(balanceData.limit ?? balanceData.data?.limit);
  const usage = Number(balanceData.usage ?? balanceData.data?.usage);
  if (Number.isFinite(limit) && Number.isFinite(usage)) {
    return limit - usage;
  }

  return null;
}

function summarizeUsability(valid, modelCount) {
  if (!valid) {
    return "No. The provider rejected this key.";
  }

  if (modelCount > 0) {
    return "Yes. The key can authenticate and list at least one model.";
  }

  return "Probably. The key authenticated, but model access could not be confirmed from the response.";
}

function summarizeBalance(provider, successfulBalance, balanceAttempts, estimatedTokensLeft) {
  if (successfulBalance) {
    return estimatedTokensLeft === null
      ? "Balance was found, but token estimation needs a supported model price."
      : "Estimated from the detected remaining balance and the selected model's input price.";
  }

  const attempts = Array.isArray(balanceAttempts) ? balanceAttempts : [];

  if (
    provider === "openai" &&
    attempts.some((attempt) => String(attempt?.data?.error || "").includes("must be made with a session key"))
  ) {
    return "OpenAI secret API keys can validate and list models, but these billing endpoints require a browser session key, so remaining balance cannot be read here.";
  }

  if (
    provider === "openai" &&
    attempts.some((attempt) => attempt?.data?.error?.code === "missing_required_parameter")
  ) {
    return "OpenAI usage endpoints need extra parameters such as a date and still do not provide a direct remaining-balance value for this checker.";
  }

  if (
    provider === "anthropic" &&
    attempts.length > 0 &&
    attempts.every((attempt) => attempt?.status === 404)
  ) {
    return "Anthropic returned models successfully, so the Claude key is usable, but these balance endpoints are not available from this API response flow.";
  }

  return "No supported balance endpoint responded successfully for this provider/base URL.";
}

function estimateRemainingTokens(remainingUsd, model) {
  const normalizedModel = String(model || "").trim();
  const inputPricePer1M = MODEL_PRICING_PER_1M[normalizedModel];
  if (!inputPricePer1M || !Number.isFinite(remainingUsd) || remainingUsd < 0) {
    return null;
  }

  return Math.floor((remainingUsd / inputPricePer1M) * 1_000_000);
}

async function runCheck({ provider, apiKey, baseUrl, model }) {
  const providerConfig = PROVIDERS[provider];
  if (!providerConfig) {
    throw new Error("Unsupported provider.");
  }

  const headers = providerConfig.makeHeaders(apiKey);
  const validation = await fetchJson(providerConfig.validateUrl(baseUrl, apiKey), {
    method: "GET",
    headers
  });

  const models = providerConfig.extractModels ? providerConfig.extractModels(validation.data) : [];
  const modelCount = Array.isArray(models) ? models.length : 0;
  const sampleModels = models
    .slice(0, 5)
    .map((modelEntry) => modelEntry?.id || modelEntry?.name || modelEntry?.model || null)
    .filter(Boolean);

  const balanceAttempts = [];
  for (const candidateUrl of providerConfig.candidateBalanceUrls(baseUrl)) {
    try {
      const attempt = await fetchJson(candidateUrl, { method: "GET", headers });
      balanceAttempts.push(attempt);
      if (attempt.ok) {
        break;
      }
    } catch (error) {
      balanceAttempts.push({
        ok: false,
        status: 0,
        statusText: "Network error",
        url: candidateUrl,
        data: { error: error.message }
      });
    }
  }

  const successfulBalance = balanceAttempts.find((attempt) => attempt.ok) || null;
  const remainingUsd = extractRemainingUsd(successfulBalance?.data);
  const estimatedTokensLeft = estimateRemainingTokens(remainingUsd, model);

  return {
    provider: providerConfig.label,
    valid: validation.ok,
    usableInProjects: validation.ok && modelCount > 0,
    validation: {
      url: validation.url,
      status: validation.status,
      statusText: validation.statusText,
      summary: summarizeValidation(validation)
    },
    capability: {
      modelCount,
      sampleModels,
      summary: summarizeUsability(validation.ok, modelCount)
    },
    balance: {
      available: Boolean(successfulBalance),
      url: successfulBalance?.url || null,
      remainingUsd,
      estimatedTokensLeft,
      note: summarizeBalance(provider, successfulBalance, balanceAttempts, estimatedTokensLeft)
    },
    raw: {
      validation: validation.data,
      balanceAttempts: balanceAttempts.map((attempt) => ({
        url: attempt.url,
        status: attempt.status,
        ok: attempt.ok,
        data: attempt.data
      }))
    }
  };
}

function summarizeChatCheck(payload) {
  if (payload.ok) {
    return "The provider accepted the key and returned a chat response.";
  }

  return payload?.data?.error?.message || payload?.data?.message || payload?.data?.error || "Chat request failed.";
}

async function runChatCheck({ provider, apiKey, baseUrl, model }) {
  const providerConfig = PROVIDERS[provider];
  if (!providerConfig) {
    throw new Error("Unsupported provider.");
  }

  const chosenModel = String(model || "").trim() || DEFAULT_CHAT_MODELS[provider];
  if (!chosenModel) {
    throw new Error("A model is required for the chat check.");
  }

  const request = providerConfig.buildChatRequest(baseUrl, apiKey, chosenModel);
  const response = await fetchJson(request.url, request.options);

  return {
    provider: providerConfig.label,
    valid: response.ok,
    model: chosenModel,
    chat: {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      summary: summarizeChatCheck(response),
      replyPreview: providerConfig.summarizeChatResponse(response.data)
    },
    raw: response.data
  };
}

module.exports = {
  MODEL_PRICING_PER_1M,
  PROVIDERS,
  normalizeBaseUrl,
  extractRemainingUsd,
  estimateRemainingTokens,
  summarizeUsability,
  runCheck,
  runChatCheck
};
