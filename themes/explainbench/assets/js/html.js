export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function icon(name) {
  return `<i data-lucide="${esc(name)}" aria-hidden="true"></i>`;
}

export function formatScore(value, format) {
  if (format === "percent") {
    return `${Math.round(value * 1000) / 10}%`;
  }
  return value.toFixed(3);
}
