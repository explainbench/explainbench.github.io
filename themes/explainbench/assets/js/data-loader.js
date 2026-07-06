function assetUrl(path) {
  return new URL(path, document.baseURI).toString();
}

function readRuntimeConfig() {
  const configNode = document.querySelector("#site-config");
  if (!configNode?.textContent) {
    throw new Error("Missing generated site config.");
  }
  return JSON.parse(configNode.textContent);
}

async function loadJson(label, path) {
  const response = await fetch(assetUrl(path), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${label}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function loadSiteData(keys = null) {
  const config = readRuntimeConfig();
  const dataFiles = config.dataFiles ?? {};
  const requestedKeys = Array.isArray(keys) ? new Set(keys) : null;
  const selectedFiles = requestedKeys
    ? Object.fromEntries(Object.entries(dataFiles).filter(([label]) => requestedKeys.has(label)))
    : dataFiles;
  const entries = await Promise.allSettled(
    Object.entries(selectedFiles).map(async ([label, path]) => [label, await loadJson(label, path)])
  );

  const data = {};
  const errors = [];
  for (const entry of entries) {
    if (entry.status === "fulfilled") {
      const [label, value] = entry.value;
      data[label] = value;
    } else {
      errors.push(entry.reason.message);
    }
  }

  return { config, data, errors };
}
