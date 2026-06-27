const providerSelect = document.getElementById("provider");
const baseUrlInput = document.getElementById("baseUrl");
const apiKeyInput = document.getElementById("apiKey");
const form = document.getElementById("checker-form");
const submitBtn = document.getElementById("submitBtn");
const chatCheckBtn = document.getElementById("chatCheckBtn");
const toggleApiKeyBtn = document.getElementById("toggleApiKeyBtn");
const statusBox = document.getElementById("status");
const resultsSection = document.getElementById("results");
const summaryGrid = document.getElementById("summaryGrid");
const notes = document.getElementById("notes");
const chatResultsSection = document.getElementById("chatResults");
const chatSummaryGrid = document.getElementById("chatSummaryGrid");
const chatNotes = document.getElementById("chatNotes");
const historyMeta = document.getElementById("historyMeta");
const historyList = document.getElementById("historyList");
const refreshHistoryBtn = document.getElementById("refreshHistoryBtn");

let supabaseEnabled = false;

async function loadProviders() {
  const response = await fetch("/api/providers");
  const data = await response.json();

  providerSelect.innerHTML = data.providers
    .map(
      (provider) =>
          `<option value="${provider.id}" data-base-url="${provider.defaultBaseUrl}">${provider.label}</option>`
    )
    .join("");

  baseUrlInput.value = data.providers[0]?.defaultBaseUrl || "";
  supabaseEnabled = Boolean(data.storage?.supabaseConfigured);
  historyMeta.textContent = supabaseEnabled
    ? `Saving rows to Supabase table "${data.storage.table}".`
    : "Supabase is not configured yet. Add your credentials to .env and restart the server.";
}

function setStatus(message, type = "muted") {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`;
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat().format(value);
}

function renderStat(label, value) {
  const div = document.createElement("div");
  div.className = "stat";
  div.innerHTML = `<span class="label">${label}</span><span class="value">${value}</span>`;
  return div;
}

function renderResults(result) {
  summaryGrid.innerHTML = "";
  summaryGrid.appendChild(renderStat("Provider", result.provider));
  summaryGrid.appendChild(renderStat("Valid", result.valid ? "Yes" : "No"));
  summaryGrid.appendChild(renderStat("Usable In Projects", result.usableInProjects ? "Yes" : "No / Unclear"));
  summaryGrid.appendChild(
    renderStat("Validation Status", `${result.validation.status} ${result.validation.statusText}`)
  );
  summaryGrid.appendChild(renderStat("Models Found", formatNumber(result.capability.modelCount)));
  summaryGrid.appendChild(
    renderStat(
      "Sample Models",
      result.capability.sampleModels.length ? result.capability.sampleModels.join(", ") : "N/A"
    )
  );
  summaryGrid.appendChild(
    renderStat("Remaining USD", result.balance.remainingUsd === null ? "N/A" : `$${result.balance.remainingUsd}`)
  );
  summaryGrid.appendChild(
    renderStat(
      "Estimated Tokens Left",
      result.balance.estimatedTokensLeft === null ? "N/A" : formatNumber(result.balance.estimatedTokensLeft)
    )
  );
  summaryGrid.appendChild(renderStat("Balance Endpoint", result.balance.available ? "Found" : "Not found"));

  notes.textContent = `${result.capability.summary} ${result.validation.summary} ${result.balance.note}`;
  resultsSection.classList.remove("hidden");
}

function renderChatResults(result) {
  chatSummaryGrid.innerHTML = "";
  chatSummaryGrid.appendChild(renderStat("Provider", result.provider));
  chatSummaryGrid.appendChild(renderStat("Valid Chat Request", result.valid ? "Yes" : "No"));
  chatSummaryGrid.appendChild(renderStat("Model Used", result.model));
  chatSummaryGrid.appendChild(
    renderStat("Chat Status", `${result.chat.status} ${result.chat.statusText}`)
  );
  chatSummaryGrid.appendChild(renderStat("Reply Preview", result.chat.replyPreview || "N/A"));

  chatNotes.textContent = result.chat.summary;
  chatResultsSection.classList.remove("hidden");
}

function formatUsd(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "N/A";
  }

  return `$${Number(value).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function renderHistory(items) {
  historyList.innerHTML = "";

  if (!items.length) {
    historyList.innerHTML = '<p class="empty-state">No saved rows yet.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const article = document.createElement("article");
    article.className = "history-item";

    const stats = [
      `Type: ${item.check_type}`,
      `Key: ${item.api_key_preview}`,
      `Valid: ${item.valid ? "Yes" : "No"}`,
      item.usable_in_projects === null ? null : `Usable: ${item.usable_in_projects ? "Yes" : "No"}`,
      `Balance: ${formatUsd(item.remaining_usd)}`,
      `Tokens: ${
        item.estimated_tokens_left === null ? "N/A" : formatNumber(Number(item.estimated_tokens_left))
      }`
    ]
      .filter(Boolean)
      .join(" • ");

    article.innerHTML = `
      <div class="history-topline">
        <strong>${item.provider_label}</strong>
        <span>${formatDate(item.created_at)}</span>
      </div>
      <p class="history-copy">${item.model || "No model selected"} • ${item.base_url}</p>
      <p class="history-copy">${stats}</p>
      <p class="history-note">${item.reply_preview || item.notes || "No notes recorded."}</p>
    `;

    fragment.appendChild(article);
  });

  historyList.appendChild(fragment);
}

async function loadHistory() {
  refreshHistoryBtn.disabled = true;

  try {
    const response = await fetch("/api/history");
    const data = await response.json();
    supabaseEnabled = Boolean(data.enabled);

    if (!data.enabled) {
      historyList.innerHTML =
        '<p class="empty-state">Supabase is not configured yet, so history cannot be loaded.</p>';
      return;
    }

    renderHistory(Array.isArray(data.items) ? data.items : []);
  } catch (error) {
    historyList.innerHTML = `<p class="empty-state">Failed to load history: ${error.message || "Unknown error"}</p>`;
  } finally {
    refreshHistoryBtn.disabled = false;
  }
}

function describeSaveState(storage) {
  if (!storage?.configured) {
    return " Supabase saving is currently off.";
  }

  if (storage.saved) {
    return " Saved to Supabase.";
  }

  if (storage.error) {
    return ` Supabase save failed: ${storage.error}`;
  }

  return "";
}

function getPayload() {
  return {
    provider: providerSelect.value,
    baseUrl: baseUrlInput.value,
    apiKey: apiKeyInput.value,
    model: document.getElementById("model").value
  };
}

toggleApiKeyBtn.addEventListener("click", () => {
  const shouldReveal = apiKeyInput.type === "password";
  apiKeyInput.type = shouldReveal ? "text" : "password";
  toggleApiKeyBtn.textContent = shouldReveal ? "Hide" : "Show";
});

providerSelect.addEventListener("change", () => {
  const selected = providerSelect.selectedOptions[0];
  baseUrlInput.value = selected?.dataset.baseUrl || "";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitBtn.disabled = true;
  chatCheckBtn.disabled = true;
  setStatus("Checking the API key and looking for balance data...");

  const payload = getPayload();

  try {
    const response = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Check failed.");
    }

    renderResults(result);
    setStatus(
      `${result.valid ? "Key looks valid." : "Key was rejected by the provider."}${describeSaveState(result.storage)}`,
      result.valid ? "good" : "bad"
    );
    await loadHistory();
  } catch (error) {
    resultsSection.classList.add("hidden");
    setStatus(error.message || "Unexpected error.", "bad");
  } finally {
    submitBtn.disabled = false;
    chatCheckBtn.disabled = false;
  }
});

chatCheckBtn.addEventListener("click", async () => {
  submitBtn.disabled = true;
  chatCheckBtn.disabled = true;
  setStatus("Sending a small chat request to confirm the key works in real usage...");

  try {
    const response = await fetch("/api/chat-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getPayload())
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Chat check failed.");
    }

    renderChatResults(result);
    setStatus(
      `${result.valid ? "Chat request succeeded. The key is working." : "Chat request was rejected."}${describeSaveState(result.storage)}`,
      result.valid ? "good" : "bad"
    );
    await loadHistory();
  } catch (error) {
    chatResultsSection.classList.add("hidden");
    setStatus(error.message || "Unexpected error.", "bad");
  } finally {
    submitBtn.disabled = false;
    chatCheckBtn.disabled = false;
  }
});

refreshHistoryBtn.addEventListener("click", () => {
  loadHistory().catch((error) => {
    historyList.innerHTML = `<p class="empty-state">Failed to load history: ${error.message || "Unknown error"}</p>`;
  });
});

loadProviders().catch((error) => {
  setStatus(error.message || "Failed to load providers.", "bad");
});

loadHistory().catch((error) => {
  historyList.innerHTML = `<p class="empty-state">Failed to load history: ${error.message || "Unknown error"}</p>`;
});
