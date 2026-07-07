import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutputFile = path.join(rootDir, "data", "leaderboard.json");

const metricConfigs = [
  {
    dir: "e2e_intent",
    key: "endToEndIntent",
    label: "End-to-end intent",
    shortLabel: "E2E intent",
    icon: "target"
  },
  {
    dir: "e2e_effect",
    key: "endToEndEffect",
    label: "End-to-end effect",
    shortLabel: "E2E effect",
    icon: "activity"
  },
  {
    dir: "local_intent",
    key: "localIntent",
    label: "Local intent",
    shortLabel: "Local intent",
    icon: "crosshair"
  },
  {
    dir: "local_effect",
    key: "localEffect",
    label: "Local effect",
    shortLabel: "Local effect",
    icon: "git-compare-arrows"
  }
];

const knownRunLabels = new Map([
  ["Refact_Agent_claude-4-sonnet", { agent: "Refact Agent", framework: "Claude 4 Sonnet" }],
  ["Lingxi-v1.5_claude-4-sonnet-20250514", { agent: "Lingxi v1.5", framework: "Claude 4 Sonnet" }],
  ["openhands-Qwen3-Coder-480B-A35B-Instruct", { agent: "OpenHands", framework: "Qwen3 Coder 480B A35B Instruct" }],
  ["mini-v1.7.0_gpt-5-mini", { agent: "mini-SWE-agent v1.7.0", framework: "GPT-5 mini" }],
  ["trae_doubao_seed_code", { agent: "Trae Agent", framework: "Doubao Seed Code" }],
  ["openhands_claude-opus-4-5", { agent: "OpenHands", framework: "Claude Opus 4.5" }],
  ["openhands_gpt-5-mini", { agent: "OpenHands", framework: "GPT-5 mini" }],
  ["openhands_minimax-m2.5", { agent: "OpenHands", framework: "MiniMax M2.5" }]
]);

function normalizeRepository(value) {
  const repository = String(value || "explainbench/explainbench").trim();
  const [owner, name] = repository.split("/");
  if (!owner || !name || repository.split("/").length !== 2) {
    throw new Error(`Invalid EXPLAINBENCH_RESULTS_REPOSITORY value: ${repository}`);
  }
  return { owner, name, slug: repository };
}

function githubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "explainbench-page-build"
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchJson(url, headers = githubHeaders()) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const detail = body ? `: ${body.slice(0, 300)}` : "";
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}${detail}`);
  }
  return response.json();
}

function githubContentUrl(apiBase, contentPath, ref) {
  const encodedPath = contentPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${apiBase}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`;
}

async function fetchCommitSha(apiBase, ref) {
  try {
    const commit = await fetchJson(`${apiBase}/commits/${encodeURIComponent(ref)}`);
    return typeof commit.sha === "string" ? commit.sha : "";
  } catch {
    return "";
  }
}

async function listMetricFiles(apiBase, resultsPath, metricDir, ref) {
  const entries = await fetchJson(githubContentUrl(apiBase, `${resultsPath}/${metricDir}`, ref));
  if (!Array.isArray(entries)) {
    throw new Error(`Expected ${resultsPath}/${metricDir} to be a directory.`);
  }
  return entries
    .filter((entry) => entry.type === "file")
    .filter((entry) => entry.name.endsWith(".json"))
    .filter((entry) => !entry.name.startsWith("audit_"))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function scoreFromResult(result, fileName) {
  const mean = result?.statistics?.mean;
  if (Number.isFinite(mean)) {
    return mean;
  }

  const values = result?.statistics?.metric_values;
  if (Array.isArray(values) && values.length > 0 && values.every(Number.isFinite)) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  throw new Error(`Could not find statistics.mean in ${fileName}.`);
}

function runIdFromFileName(fileName) {
  return path.basename(fileName, ".json").split("__")[0];
}

function displayRunId(runId) {
  return runId.replace(/^\d{8}_/, "");
}

function humanizeLabel(value) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
    .replace(/\bGpt\b/g, "GPT")
    .replace(/\bQwen\b/g, "Qwen")
    .replace(/\bSwe\b/g, "SWE");
}

function agentInfoForRun(runId) {
  const displayId = displayRunId(runId);
  const known = knownRunLabels.get(displayId);
  if (known) {
    return known;
  }
  return {
    agent: humanizeLabel(displayId),
    framework: "Imported result"
  };
}

function roundScore(value) {
  return Number(value.toFixed(6));
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function collectMetricResults({ apiBase, resultsPath, ref }) {
  const rows = new Map();

  for (const metric of metricConfigs) {
    const files = await listMetricFiles(apiBase, resultsPath, metric.dir, ref);
    const results = await Promise.all(
      files.map(async (file) => {
        if (!file.download_url) {
          throw new Error(`Missing download_url for ${file.path}`);
        }
        const result = await fetchJson(file.download_url, {});
        return {
          file,
          runId: runIdFromFileName(file.name),
          score: roundScore(scoreFromResult(result, file.name))
        };
      })
    );

    for (const result of results) {
      const info = agentInfoForRun(result.runId);
      const row = rows.get(result.runId) ?? {
        id: result.runId,
        agent: info.agent,
        framework: info.framework,
        sourceFiles: []
      };
      row[metric.key] = result.score;
      row.sourceFiles.push(result.file.path);
      rows.set(result.runId, row);
    }
  }

  return [...rows.values()];
}

function buildLeaderboard({ rows, repository, resultsPath, ref, commitSha }) {
  const requiredMetricKeys = metricConfigs.map((metric) => metric.key);
  const completeRows = rows.filter((row) => requiredMetricKeys.every((key) => Number.isFinite(row[key])));
  const includedRows = completeRows.length > 0 ? completeRows : rows;
  const skippedIncomplete = completeRows.length > 0 ? rows.length - completeRows.length : 0;

  const agents = includedRows
    .map((row) => {
      const metricValues = requiredMetricKeys.map((key) => row[key]).filter(Number.isFinite);
      return {
        id: row.id,
        agent: row.agent,
        framework: row.framework,
        explanationScore: roundScore(mean(metricValues)),
        ...Object.fromEntries(requiredMetricKeys.map((key) => [key, row[key] ?? null])),
        note:
          metricValues.length === requiredMetricKeys.length
            ? "Computed from non-audit evaluation result files."
            : `Partial result: ${metricValues.length} of ${requiredMetricKeys.length} metrics available.`
      };
    })
    .sort((a, b) => b.explanationScore - a.explanationScore || a.agent.localeCompare(b.agent));

  const commitLabel = commitSha ? ` @ ${commitSha.slice(0, 7)}` : "";
  const skippedNote =
    skippedIncomplete > 0 ? ` ${skippedIncomplete} incomplete agent row${skippedIncomplete === 1 ? " was" : "s were"} omitted.` : "";

  return {
    datasetLabel: `${repository} ${resultsPath}${commitLabel}`,
    source: {
      repository,
      path: resultsPath,
      ref,
      commit: commitSha || null
    },
    metrics: [
      {
        key: "explanationScore",
        label: "Explanation score",
        shortLabel: "Expl. score",
        format: "decimal",
        icon: "award"
      },
      ...metricConfigs.map((metric) => ({
        key: metric.key,
        label: metric.label,
        shortLabel: metric.shortLabel,
        format: "decimal",
        icon: metric.icon
      }))
    ],
    agents,
    methodology: {
      title: "Methodology",
      body:
        "The build imports non-audit JSON files from results/evaluation, reads statistics.mean for each explanation metric, and averages the four metric means into the Explanation score."
    },
    updatePolicy: {
      title: "Update policy",
      body: `Scores refresh from ${repository}/${resultsPath} whenever the site is rebuilt. Rows require all four explanation metrics.${skippedNote}`
    }
  };
}

export async function prepareLeaderboardData(options = {}) {
  const { owner, name, slug } = normalizeRepository(options.repository ?? process.env.EXPLAINBENCH_RESULTS_REPOSITORY);
  const ref = String(options.ref ?? process.env.EXPLAINBENCH_RESULTS_REF ?? "main");
  const resultsPath = String(options.resultsPath ?? process.env.EXPLAINBENCH_RESULTS_PATH ?? "results/evaluation").replace(/\/+$/, "");
  const outputFile = options.outputFile ?? defaultOutputFile;
  const apiBase = `https://api.github.com/repos/${owner}/${name}`;

  const [commitSha, rows] = await Promise.all([
    fetchCommitSha(apiBase, ref),
    collectMetricResults({ apiBase, resultsPath, ref })
  ]);

  const leaderboard = buildLeaderboard({
    rows,
    repository: slug,
    resultsPath,
    ref,
    commitSha
  });

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, `${JSON.stringify(leaderboard, null, 2)}\n`);

  console.log(
    `Prepared ${path.relative(rootDir, outputFile)} from ${slug}/${resultsPath}` +
      ` (${leaderboard.agents.length} agents${commitSha ? `, ${commitSha.slice(0, 7)}` : ""}).`
  );
}

if (pathToFileURL(process.argv[1] || "").href === import.meta.url) {
  await prepareLeaderboardData();
}
