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

function inlineMarkdown(value) {
  return esc(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function flushParagraph(blocks, lines) {
  if (!lines.length) return;
  blocks.push(`<p>${lines.map(inlineMarkdown).join("<br>")}</p>`);
  lines.length = 0;
}

function flushList(blocks, lines) {
  if (!lines.length) return;
  blocks.push(`<ul>${lines.map((line) => `<li>${inlineMarkdown(line)}</li>`).join("")}</ul>`);
  lines.length = 0;
}

export function markdownToHtml(value) {
  const lines = String(value ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  const paragraphLines = [];
  const listLines = [];
  let codeLines = null;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      flushParagraph(blocks, paragraphLines);
      flushList(blocks, listLines);
      if (codeLines) {
        blocks.push(`<pre><code>${esc(codeLines.join("\n"))}</code></pre>`);
        codeLines = null;
      } else {
        codeLines = [];
      }
      continue;
    }

    if (codeLines) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph(blocks, paragraphLines);
      flushList(blocks, listLines);
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph(blocks, paragraphLines);
      flushList(blocks, listLines);
      blocks.push(`<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`);
      continue;
    }

    const listItem = line.match(/^\s*[-*]\s+(.+)$/);
    if (listItem) {
      flushParagraph(blocks, paragraphLines);
      listLines.push(listItem[1]);
      continue;
    }

    flushList(blocks, listLines);
    paragraphLines.push(line);
  }

  if (codeLines) {
    blocks.push(`<pre><code>${esc(codeLines.join("\n"))}</code></pre>`);
  }
  flushParagraph(blocks, paragraphLines);
  flushList(blocks, listLines);

  return blocks.join("");
}
