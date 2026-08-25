import { showToast, showConfirmDialog } from "./toast.js";
import { escapeHtml } from "./utils.js";

/**
 * Admin UI for managing API keys.
 */
export function bindApiKeyEvents(ctx) {
  const { els } = ctx;

  if (els.createApiKeyBtn) {
    els.createApiKeyBtn.addEventListener("click", async () => {
      const name = els.apiKeyName.value.trim();
      if (!name) {
        showToast("Nama API key wajib diisi", "error");
        return;
      }
      els.createApiKeyBtn.disabled = true;
      try {
        const { postJson } = await import("./api.js");
        const data = await postJson("/api/apikeys", { action: "create", payload: { name } }, "Gagal membuat API key");
        els.apiKeyValue.textContent = data.key;
        els.apiKeyResult.classList.remove("hidden");
        els.apiKeyName.value = "";
        showToast("API key berhasil dibuat", "success");
        await loadApiKeys(ctx);
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        els.createApiKeyBtn.disabled = false;
      }
    });
  }

  if (els.apiKeyList) {
    els.apiKeyList.addEventListener("click", async (e) => {
      const revokeBtn = e.target.closest(".revoke-api-key-btn");
      if (!revokeBtn) return;
      const keyId = revokeBtn.dataset.keyId;
      if (!await showConfirmDialog("Revoke API key ini? Sistem eksternal yang memakainya tidak akan bisa mengakses lagi.", "Revoke API Key")) return;
      try {
        const { postJson } = await import("./api.js");
        await postJson("/api/apikeys", { action: "revoke", payload: { keyId } }, "Gagal revoke API key");
        showToast("API key di-revoke", "success");
        await loadApiKeys(ctx);
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }
}

export async function loadApiKeys(ctx) {
  const { els } = ctx;
  if (!els.apiKeyList) return;
  try {
    const response = await fetch("/api/apikeys", { credentials: "include" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Gagal memuat API key");
    renderApiKeys(ctx, data.keys || []);
  } catch (err) {
    showToast(err.message, "error");
  }
}

function renderApiKeys(ctx, keys) {
  const { els } = ctx;
  if (!keys.length) {
    els.apiKeyList.className = "list-stack empty-state";
    els.apiKeyList.textContent = "Belum ada API key.";
    return;
  }
  els.apiKeyList.className = "list-stack";
  els.apiKeyList.innerHTML = keys.map((key) => `
    <article class="list-item" style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
      <div style="flex:1; min-width:0;">
        <strong>${escapeHtml(key.name)}</strong>
        <p style="font-size:0.85rem; color:var(--muted);">${escapeHtml(key.prefix)}… · Dibuat ${escapeHtml(new Date(key.createdAt).toLocaleDateString("id-ID"))}${key.lastUsedAt ? ` · Terakhir dipakai ${escapeHtml(new Date(key.lastUsedAt).toLocaleString("id-ID"))}` : ""}</p>
      </div>
      <button type="button" class="action-button danger-button revoke-api-key-btn" data-key-id="${escapeHtml(key.id)}">Revoke</button>
    </article>
  `).join("");
}