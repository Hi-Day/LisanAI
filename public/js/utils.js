import { STOPWORDS } from "./config.js";

export function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function compactText(value, max = 130) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getKeywords(...values) {
  const words = values
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\s]/gi, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4 && !STOPWORDS.has(word));

  return [...new Set(words)].slice(0, 12);
}

export function average(items, picker) {
  if (!items.length) return 0;
  return Math.round(items.reduce((sum, item) => sum + picker(item), 0) / items.length);
}

export function toArray(value) {
  return Array.isArray(value) ? value : [];
}
