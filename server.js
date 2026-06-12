const fs = require("fs");
const path = require("path");

const debugHandler = require("./api/debug");
const providersHandler = require("./api/providers");
const checkHandler = require("./api/check");
const chatCheckHandler = require("./api/chat-check");

const ROOT_DIR = __dirname;
const INLINE_STYLES = `:root {
  --bg: #f5efe4;
  --bg-accent: #e6dcc8;
  --card: rgba(255, 252, 246, 0.92);
  --line: #c3b79f;
  --text: #1f1b16;
  --muted: #645a4f;
  --good: #1e7a49;
  --bad: #b13d2f;
  --button: #1f4f46;
  --button-hover: #173a34;
  --shadow: 0 22px 60px rgba(31, 27, 22, 0.12);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  font-family: Georgia, "Times New Roman", serif;
  color: var(--text);
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.75), transparent 28%),
    linear-gradient(135deg, var(--bg) 0%, var(--bg-accent) 100%);
  overflow-x: hidden;
}
.shell { width: min(1100px, calc(100% - 32px)); margin: 0 auto; padding: 56px 0 72px; }
.hero { margin-bottom: 28px; }
.eyebrow { margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.18em; font-size: 0.75rem; color: var(--muted); }
h1, h2 { margin: 0; font-weight: 600; }
h1 { font-size: clamp(2.4rem, 6vw, 4.4rem); line-height: 0.95; }
.lede { max-width: 54rem; margin: 14px 0 0; font-size: 1.05rem; color: var(--muted); }
.panel, .card {
  background: var(--card);
  border: 1px solid rgba(195, 183, 159, 0.5);
  border-radius: 24px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(14px);
}
.panel { padding: 24px; }
.form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; align-items: end; }
.form label { display: flex; flex-direction: column; gap: 8px; font-size: 0.98rem; min-width: 0; }
.form label:nth-child(3) { grid-column: 1 / -1; }
.form button { width: 100%; }
.actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
input, select, button { font: inherit; }
input, select {
  width: 100%;
  min-width: 0;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.88);
  color: var(--text);
}
button {
  align-self: end;
  height: 52px;
  border: 0;
  border-radius: 14px;
  background: var(--button);
  color: #fffdf7;
  cursor: pointer;
  transition: background 140ms ease, transform 140ms ease;
}
button:hover { background: var(--button-hover); transform: translateY(-1px); }
button:disabled { opacity: 0.7; cursor: wait; transform: none; }
.secondary-button { background: transparent; color: var(--button); border: 1px solid rgba(31, 79, 70, 0.28); }
.secondary-button:hover { background: rgba(31, 79, 70, 0.08); }
.status {
  margin-top: 18px;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(31, 79, 70, 0.08);
  border: 1px solid rgba(31, 79, 70, 0.14);
}
.status.good { color: var(--good); background: rgba(30, 122, 73, 0.08); border-color: rgba(30, 122, 73, 0.16); }
.status.bad { color: var(--bad); background: rgba(177, 61, 47, 0.08); border-color: rgba(177, 61, 47, 0.16); }
.muted { color: var(--muted); }
.results { display: grid; gap: 18px; margin-top: 18px; }
.card { padding: 22px; }
.summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 14px; margin-top: 16px; }
.stat { padding: 14px; border-radius: 16px; background: rgba(255, 255, 255, 0.74); border: 1px solid rgba(195, 183, 159, 0.45); }
.stat span { display: block; }
.stat .label { margin-bottom: 6px; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
.stat .value { font-size: 1.15rem; font-weight: 600; word-break: break-word; overflow-wrap: anywhere; }
.hidden { display: none; }
@media (max-width: 840px) {
  .form { grid-template-columns: 1fr; }
  .form label:nth-child(3) { grid-column: auto; }
  .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .actions { grid-template-columns: 1fr; }
}`;
const INLINE_INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI API Key Checker</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <p class="eyebrow">Local utility</p>
        <h1>AI API Key Checker</h1>
        <p class="lede">Validate an AI API key, check whether it is usable in a real project, and estimate remaining tokens when the provider exposes balance data.</p>
      </section>
      <section class="panel">
        <form id="checker-form" class="form">
          <label>Provider<select id="provider" name="provider"></select></label>
          <label>Base URL<input id="baseUrl" name="baseUrl" type="text" placeholder="https://api.openai.com/v1" required /></label>
          <label>API Key<input id="apiKey" name="apiKey" type="password" placeholder="Paste your API key" required /></label>
          <label>Pricing Model<input id="model" name="model" type="text" placeholder="gpt-4.1-mini / gemini-2.5-flash / claude-sonnet-4 / deepseek-v4-flash" /></label>
          <div class="actions">
            <button type="submit" id="submitBtn">Check Key</button>
            <button type="button" id="chatCheckBtn" class="secondary-button">Chat Check</button>
          </div>
        </form>
        <div id="status" class="status muted">Waiting for input.</div>
      </section>
      <section id="results" class="results hidden">
        <article class="card">
          <h2>Summary</h2>
          <div id="summaryGrid" class="summary-grid"></div>
        </article>
        <article class="card">
          <h2>Notes</h2>
          <p id="notes"></p>
        </article>
      </section>
      <section id="chatResults" class="results hidden">
        <article class="card">
          <h2>Chat Check</h2>
          <div id="chatSummaryGrid" class="summary-grid"></div>
        </article>
        <article class="card">
          <h2>Chat Notes</h2>
          <p id="chatNotes"></p>
        </article>
      </section>
    </main>
    <script>
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
          .map(function(provider) {
            return '<option value="' + provider.id + '" data-base-url="' + provider.defaultBaseUrl + '">' + provider.label + "</option>";
          })
          .join("");
        baseUrlInput.value = data.providers[0] ? data.providers[0].defaultBaseUrl : "";
      }

      function setStatus(message, type) {
        statusBox.textContent = message;
        statusBox.className = "status " + (type || "muted");
      }

      function formatNumber(value) {
        if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
        return new Intl.NumberFormat().format(value);
      }

      function renderStat(label, value) {
        const div = document.createElement("div");
        div.className = "stat";
        div.innerHTML = '<span class="label">' + label + '</span><span class="value">' + value + "</span>";
        return div;
      }

      function renderResults(result) {
        summaryGrid.innerHTML = "";
        summaryGrid.appendChild(renderStat("Provider", result.provider));
        summaryGrid.appendChild(renderStat("Valid", result.valid ? "Yes" : "No"));
        summaryGrid.appendChild(renderStat("Usable In Projects", result.usableInProjects ? "Yes" : "No / Unclear"));
        summaryGrid.appendChild(renderStat("Validation Status", result.validation.status + " " + result.validation.statusText));
        summaryGrid.appendChild(renderStat("Models Found", formatNumber(result.capability.modelCount)));
        summaryGrid.appendChild(renderStat("Sample Models", result.capability.sampleModels.length ? result.capability.sampleModels.join(", ") : "N/A"));
        summaryGrid.appendChild(renderStat("Remaining USD", result.balance.remainingUsd === null ? "N/A" : "$" + result.balance.remainingUsd));
        summaryGrid.appendChild(renderStat("Estimated Tokens Left", result.balance.estimatedTokensLeft === null ? "N/A" : formatNumber(result.balance.estimatedTokensLeft)));
        summaryGrid.appendChild(renderStat("Balance Endpoint", result.balance.available ? "Found" : "Not found"));
        notes.textContent = result.capability.summary + " " + result.validation.summary + " " + result.balance.note;
        resultsSection.classList.remove("hidden");
      }

      function renderChatResults(result) {
        chatSummaryGrid.innerHTML = "";
        chatSummaryGrid.appendChild(renderStat("Provider", result.provider));
        chatSummaryGrid.appendChild(renderStat("Valid Chat Request", result.valid ? "Yes" : "No"));
        chatSummaryGrid.appendChild(renderStat("Model Used", result.model));
        chatSummaryGrid.appendChild(renderStat("Chat Status", result.chat.status + " " + result.chat.statusText));
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

      providerSelect.addEventListener("change", function() {
        const selected = providerSelect.selectedOptions[0];
        baseUrlInput.value = selected ? selected.dataset.baseUrl : "";
      });

      form.addEventListener("submit", async function(event) {
        event.preventDefault();
        submitBtn.disabled = true;
        chatCheckBtn.disabled = true;
        setStatus("Checking the API key and looking for balance data...");
        try {
          const response = await fetch("/api/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(getPayload())
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Check failed.");
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

      chatCheckBtn.addEventListener("click", async function() {
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
          if (!response.ok) throw new Error(result.error || "Chat check failed.");
          renderChatResults(result);
          setStatus(result.valid ? "Chat request succeeded. The key is working." : "Chat request was rejected.", result.valid ? "good" : "bad");
        } catch (error) {
          chatResultsSection.classList.add("hidden");
          setStatus(error.message || "Unexpected error.", "bad");
        } finally {
          submitBtn.disabled = false;
          chatCheckBtn.disabled = false;
        }
      });

      loadProviders().catch(function(error) {
        setStatus(error.message || "Failed to load providers.", "bad");
      });
    </script>
  </body>
</html>`;

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data, null, 2));
}

async function sendFile(res, fileName, contentType) {
  try {
    const content = await fs.promises.readFile(path.join(ROOT_DIR, fileName));
    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    res.end(content);
  } catch (error) {
    if (fileName === "index.html") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(INLINE_INDEX_HTML);
      return;
    }

    if (fileName === "styles.css") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/css; charset=utf-8");
      res.end(INLINE_STYLES);
      return;
    }

    sendJson(res, 404, { error: "File not found.", detail: error.message });
  }
}

module.exports = async function handler(req, res) {
  const reqUrl = new URL(req.url, "https://local.test");

  if (reqUrl.pathname === "/api/debug") {
    await debugHandler(req, res);
    return;
  }

  if (reqUrl.pathname === "/api/providers") {
    await providersHandler(req, res);
    return;
  }

  if (reqUrl.pathname === "/api/check") {
    await checkHandler(req, res);
    return;
  }

  if (reqUrl.pathname === "/api/chat-check") {
    await chatCheckHandler(req, res);
    return;
  }

  if (reqUrl.pathname === "/favicon.ico" || reqUrl.pathname === "/favicon.png") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (reqUrl.pathname === "/styles.css") {
    await sendFile(res, "styles.css", "text/css; charset=utf-8");
    return;
  }

  if (reqUrl.pathname === "/" || reqUrl.pathname === "/index.html") {
    await sendFile(res, "index.html", "text/html; charset=utf-8");
    return;
  }

  sendJson(res, 404, { error: "Not found." });
};
