const providerSelect = document.getElementById("provider");
const baseUrlInput = document.getElementById("baseUrl");
const form = document.getElementById("checker-form");
const submitBtn = document.getElementById("submitBtn");
const chatCheckBtn = document.getElementById("chatCheckBtn");
const statusBox = document.getElementById("status");
const resultsSection = document.getElementById("results");
const summaryGrid = document.getElementById("summaryGrid");
const notes = document.getElementById("notes");
const chatResultsSection = document.getElementById("chatResults");
const chatSummaryGrid = document.getElementById("chatSummaryGrid");
const chatNotes = document.getElementById("chatNotes");

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

function getPayload() {
  return {
    provider: providerSelect.value,
    baseUrl: baseUrlInput.value,
    apiKey: document.getElementById("apiKey").value,
    model: document.getElementById("model").value
  };
}

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
    setStatus(result.valid ? "Key looks valid." : "Key was rejected by the provider.", result.valid ? "good" : "bad");
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
      result.valid ? "Chat request succeeded. The key is working." : "Chat request was rejected.",
      result.valid ? "good" : "bad"
    );
  } catch (error) {
    chatResultsSection.classList.add("hidden");
    setStatus(error.message || "Unexpected error.", "bad");
  } finally {
    submitBtn.disabled = false;
    chatCheckBtn.disabled = false;
  }
});

loadProviders().catch((error) => {
  setStatus(error.message || "Failed to load providers.", "bad");
});
