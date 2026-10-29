#!/usr/bin/env node
"use strict";

const { loadEnv } = require("../server/config");
loadEnv();

const errors = [];
const required = (name) => String(process.env[name] || "").trim();
const isPlaceholder = (value) => !value || /replace-with|example\.edu|example\.com|<[^>]+>|changeme|your[-_ ]?(key|secret|domain)/i.test(value);

function requireReal(name, predicate, message) {
  const value = required(name);
  if (isPlaceholder(value) || !predicate(value)) errors.push(`${name}: ${message}`);
  return value;
}

const origin = requireReal("LTI_PUBLIC_ORIGIN", (v) => {
  try { const u = new URL(v); return u.protocol === "https:" && u.origin === v && u.hostname === "lisanai.binus.ac.id"; } catch { return false; }
}, "harus berupa https://lisanai.binus.ac.id");
const launchUrl = requireReal("LTI_LAUNCH_URL", (v) => {
  try { const u = new URL(v); return u.protocol === "https:" && u.origin === origin && u.pathname === "/api/lti"; } catch { return false; }
}, "harus berupa URL HTTPS /api/lti pada origin yang sama");
requireReal("LTI_TENANT_ID", (v) => v.length > 0, "isi ID tenant BINUS yang sudah ada; jangan gunakan tenant demo");
requireReal("CSRF_SECRET", (v) => v.length >= 32, "gunakan secret acak minimal 32 karakter");
requireReal("OPENROUTER_API_KEY", (v) => v.length >= 16, "masukkan API key provider yang valid");
requireReal("OPENROUTER_MODEL", (v) => v.length > 0, "model harus ditentukan");

const databaseUrl = required("TURSO_DATABASE_URL");
if (!databaseUrl.startsWith("file:/app/data/")) errors.push("TURSO_DATABASE_URL: harus memakai database lokal di volume /app/data untuk deployment ini");

let consumers = {};
try { consumers = JSON.parse(required("LTI_CONSUMERS_JSON") || "{}"); }
catch { errors.push("LTI_CONSUMERS_JSON: JSON tidak valid"); }
if (!consumers || Array.isArray(consumers) || typeof consumers !== "object" || Object.keys(consumers).length === 0) {
  errors.push("LTI_CONSUMERS_JSON: konfigurasi consumer BINUS Maya wajib diisi");
} else {
  for (const [key, secret] of Object.entries(consumers)) {
    if (isPlaceholder(key) || key.length < 4) errors.push("LTI_CONSUMERS_JSON: consumer key masih placeholder atau terlalu pendek");
    if (typeof secret !== "string" || secret.length < 32 || isPlaceholder(secret)) errors.push("LTI_CONSUMERS_JSON: setiap shared secret harus acak dan minimal 32 karakter");
  }
}

const ancestors = required("LTI_FRAME_ANCESTORS").split(",").map((v) => v.trim()).filter(Boolean);
if (!ancestors.length) errors.push("LTI_FRAME_ANCESTORS: isi origin HTTPS BINUS Maya yang tepat; jangan gunakan wildcard");
for (const value of ancestors) {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.origin !== value || isPlaceholder(value)) errors.push("LTI_FRAME_ANCESTORS: setiap nilai harus origin HTTPS tepat tanpa path atau placeholder");
  } catch { errors.push("LTI_FRAME_ANCESTORS: terdapat origin yang tidak valid"); }
}

const hosts = required("LTI_OUTCOME_HOSTS").split(",").map((v) => v.trim()).filter(Boolean);
if (!hosts.length) errors.push("LTI_OUTCOME_HOSTS: isi hostname Outcomes Service yang tepat dari administrator BINUS Maya");
for (const host of hosts) {
  if (host.includes("*") || host.includes("/") || host.includes(":") || isPlaceholder(host) || !/^[a-z0-9.-]+$/i.test(host)) {
    errors.push("LTI_OUTCOME_HOSTS: gunakan hostname HTTPS yang tepat, tanpa skema, path, port, atau wildcard");
  }
}

if (errors.length) {
  console.error("LisanAI on-premise preflight: FAILED");
  for (const error of [...new Set(errors)]) console.error(` - ${error}`);
  process.exitCode = 1;
} else {
  console.log("LisanAI on-premise preflight: PASS");
  console.log("Origin, local database target, AI API configuration, and required LTI settings are structurally configured.");
  console.log("This does not verify DNS/TLS, secret validity, LMS compatibility, or a real gradebook round-trip.");
}
