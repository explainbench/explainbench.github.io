import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutputFile = path.join(rootDir, "data", "leaderboard.json");
const explanationLimit = 1200;

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
    const error = new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}${detail}`);
    error.status = response.status;
    throw error;
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

async function fetchContentJson(rawBase, contentPath, cache) {
  const cacheKey = `${rawBase}:${contentPath}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const encodedPath = contentPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const value = await fetchJson(`${rawBase}/${encodedPath}`, {});
  cache.set(cacheKey, value);
  return value;
}

async function listMetricFiles(apiBase, rootPath, metricDir, ref, mode = "all") {
  const entries = await fetchJson(githubContentUrl(apiBase, `${rootPath}/${metricDir}`, ref));
  if (!Array.isArray(entries)) {
    throw new Error(`Expected ${rootPath}/${metricDir} to be a directory.`);
  }
  return entries
    .filter((entry) => entry.type === "file")
    .filter((entry) => entry.name.endsWith(".json"))
    .filter((entry) => {
      const isAudit = entry.name.startsWith("audit_");
      return mode === "all" || (mode === "audit" ? isAudit : !isAudit);
    })
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

function modeFromFileName(fileName) {
  return fileName.startsWith("audit_") ? "audit" : "base";
}

function runIdFromFileName(fileName) {
  return path.basename(fileName, ".json").replace(/^audit_/, "").split("__")[0];
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

function roundNullable(value) {
  return Number.isFinite(value) ? roundScore(value) : null;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function trimText(value, limit = 1800) {
  const text =
    typeof value === "string"
      ? value.trim()
      : value === null || typeof value === "undefined"
        ? ""
        : JSON.stringify(value, null, 2);
  if (!text) return "";
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trimEnd()}\n...`;
}

function trimRecord(value, limit) {
  const text = trimText(value, limit);
  return {
    text,
    truncated: text.endsWith("\n...")
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function passedCount(values) {
  return asArray(values).filter(Boolean).length;
}

function scoreFromRaw(values) {
  const rawValues = asArray(values);
  return rawValues.length > 0 ? passedCount(rawValues) / rawValues.length : null;
}

function normalizeChoice(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeChoice).filter(Boolean).join(", ");
  }
  const text = String(value ?? "").trim();
  if (!text) return "";
  const match = text.match(/[A-Za-z]/);
  return match ? match[0].toUpperCase() : text;
}

function answerDisplay(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeChoice).filter(Boolean).join(", ");
  }
  return normalizeChoice(value);
}

function expectedDisplay(metric, groundTruth) {
  if (!groundTruth) return "n/a";
  if (metric.key === "endToEndEffect") {
    return `Before ${answerDisplay(groundTruth.before_answer)} / After ${answerDisplay(groundTruth.after_answer)}`;
  }
  return answerDisplay(groundTruth.answer) || "n/a";
}

function predictionDisplay(prediction, metric) {
  if (!prediction) return "n/a";
  if (metric.key === "endToEndEffect") {
    return `Before ${answerDisplay(prediction.before_selection)} / After ${answerDisplay(prediction.after_selection)}`;
  }
  if (Object.hasOwn(prediction, "selection")) {
    return answerDisplay(prediction.selection) || "n/a";
  }
  if (Object.hasOwn(prediction, "answer")) {
    return answerDisplay(prediction.answer) || "n/a";
  }
  return trimText(prediction, 140) || "n/a";
}

function buildAttempts(rawValues, predictions, metric) {
  const raw = asArray(rawValues);
  const generated = asArray(predictions);
  const total = Math.max(raw.length, generated.length);
  return Array.from({ length: total }, (_, index) => ({
    run: index + 1,
    correct: typeof raw[index] === "undefined" ? null : Boolean(raw[index]),
    answer: predictionDisplay(generated[index], metric)
  }));
}

function contextPathForMetric(metric, runId) {
  if (metric.key === "endToEndIntent") return "dataset/context/e2e_intent.json";
  if (metric.key === "localIntent") return "dataset/context/local_intent.json";
  return `dataset/context/${metric.dir}__${runId}.json`;
}

function groundTruthPathForMetric(metric, runId) {
  if (metric.key === "endToEndIntent") return "dataset/ground_truths/e2e_intent.json";
  if (metric.key === "localIntent") return "dataset/ground_truths/local_intent.json";
  return `dataset/ground_truths/${metric.dir}__${runId}.json`;
}

function questionScopeForMetric(metric) {
  return metric.key === "endToEndIntent" || metric.key === "localIntent" ? "shared" : "byRun";
}

function choiceItems(context) {
  const choices = context?.choices;
  if (Array.isArray(choices)) {
    return choices.slice(0, 8).map((choice, index) => ({
      label: String.fromCharCode(65 + index),
      text: trimText(choice, 260)
    }));
  }
  if (choices && typeof choices === "object") {
    return Object.entries(choices)
      .slice(0, 8)
      .map(([label, choice]) => ({
        label: String(label).toUpperCase(),
        text: trimText(choice, 260)
      }));
  }
  return [];
}

function buildQuestionInstances(metric, contexts, groundTruths) {
  const ids = new Set([...Object.keys(contexts ?? {}), ...Object.keys(groundTruths ?? {})]);
  return Object.fromEntries(
    [...ids].sort().map((instanceId) => {
      const context = contexts?.[instanceId] ?? {};
      const groundTruth = groundTruths?.[instanceId] ?? null;
      return [
        instanceId,
        {
          expected: expectedDisplay(metric, groundTruth),
          choices: choiceItems(context),
          contextSections: []
        }
      ];
    })
  );
}

function slugFromGitUrl(url) {
  const normalized = String(url || "").replace(/\.git$/, "");
  const match = normalized.match(/github\.com[:/]([^/]+)\/([^/]+)$/);
  return match ? `${match[1]}/${match[2]}` : "";
}

async function fetchExplanationBundle(apiBase, ref) {
  try {
    const submodule = await fetchJson(githubContentUrl(apiBase, "dataset/explanations", ref));
    const repository = slugFromGitUrl(submodule.submodule_git_url) || "pan2013e/sweb-agent-explanations";
    const commit = submodule.sha;
    if (!commit) {
      throw new Error("dataset/explanations submodule did not include a commit sha.");
    }
    const rawBase = `https://raw.githubusercontent.com/${repository}/${commit}`;
    const [base, audit] = await Promise.all([
      fetchJson(`${rawBase}/dataset.json`, {}),
      fetchJson(`${rawBase}/audit_expls.json`, {})
    ]);
    return {
      base,
      audit,
      source: {
        repository,
        commit,
        path: "dataset/explanations"
      }
    };
  } catch (error) {
    console.warn(`Warning: explanation detail could not be fetched: ${error.message}`);
    return {
      base: {},
      audit: {},
      source: null
    };
  }
}

function explanationFor(explanations, runId, instanceId) {
  const value = explanations?.[runId]?.[instanceId];
  const text = Array.isArray(value) ? value[0] : value;
  return trimRecord(text || "", explanationLimit);
}

async function collectEvaluationResults({ apiBase, evaluationPath, ref }) {
  const rows = new Map();

  for (const metric of metricConfigs) {
    const files = await listMetricFiles(apiBase, evaluationPath, metric.dir, ref, "all");
    const results = await Promise.all(
      files.map(async (file) => {
        if (!file.download_url) {
          throw new Error(`Missing download_url for ${file.path}`);
        }
        const result = await fetchJson(file.download_url, {});
        return {
          file,
          runId: runIdFromFileName(file.name),
          mode: modeFromFileName(file.name),
          raw: result.raw ?? {},
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
        metrics: Object.fromEntries(metricConfigs.map((config) => [config.key, {}])),
        sourceFiles: []
      };
      row.metrics[metric.key][result.mode] = {
        score: result.score,
        raw: result.raw,
        sourceFile: result.file.path
      };
      row.sourceFiles.push(result.file.path);
      rows.set(result.runId, row);
    }
  }

  return [...rows.values()];
}

async function collectGenerationResults({ apiBase, generationPath, ref, runIds }) {
  const runSet = new Set(runIds);
  const generations = new Map(runIds.map((runId) => [runId, Object.fromEntries(metricConfigs.map((metric) => [metric.key, {}]))]));

  for (const metric of metricConfigs) {
    const files = await listMetricFiles(apiBase, generationPath, metric.dir, ref, "all");
    const relevantFiles = files.filter((file) => runSet.has(runIdFromFileName(file.name)));
    await Promise.all(
      relevantFiles.map(async (file) => {
        if (!file.download_url) {
          throw new Error(`Missing download_url for ${file.path}`);
        }
        const result = await fetchJson(file.download_url, {});
        const runId = runIdFromFileName(file.name);
        const mode = modeFromFileName(file.name);
        generations.get(runId)[metric.key][mode] = {
          predictions: result.predictions ?? {},
          sourceFile: file.path
        };
      })
    );
  }

  return generations;
}

async function collectQuestionBank({ rawBase, runIds }) {
  const cache = new Map();
  const shared = {};
  const byRun = {};

  for (const metric of metricConfigs) {
    if (questionScopeForMetric(metric) === "shared") {
      const [contexts, groundTruths] = await Promise.all([
        fetchContentJson(rawBase, contextPathForMetric(metric), cache),
        fetchContentJson(rawBase, groundTruthPathForMetric(metric), cache)
      ]);
      shared[metric.key] = buildQuestionInstances(metric, contexts, groundTruths);
      continue;
    }

    await Promise.all(
      runIds.map(async (runId) => {
        const [contexts, groundTruths] = await Promise.all([
          fetchContentJson(rawBase, contextPathForMetric(metric, runId), cache),
          fetchContentJson(rawBase, groundTruthPathForMetric(metric, runId), cache)
        ]);
        byRun[runId] ??= {};
        byRun[runId][metric.key] = buildQuestionInstances(metric, contexts, groundTruths);
      })
    );
  }

  return { shared, byRun };
}

function metricResultForInstance(metric, row, generations, instanceId) {
  const evaluation = row.metrics[metric.key] ?? {};
  const generation = generations?.[metric.key] ?? {};
  const baseRaw = asArray(evaluation.base?.raw?.[instanceId]);
  const auditRaw = asArray(evaluation.audit?.raw?.[instanceId]);
  const basePredictions = asArray(generation.base?.predictions?.[instanceId]);
  const auditPredictions = asArray(generation.audit?.predictions?.[instanceId]);

  return {
    scores: {
      base: roundNullable(scoreFromRaw(baseRaw)),
      audit: roundNullable(scoreFromRaw(auditRaw))
    },
    passed: {
      base: {
        count: passedCount(baseRaw),
        total: baseRaw.length
      },
      audit: {
        count: passedCount(auditRaw),
        total: auditRaw.length
      }
    },
    attempts: {
      base: buildAttempts(baseRaw, basePredictions, metric),
      audit: buildAttempts(auditRaw, auditPredictions, metric)
    }
  };
}

function aggregateInstanceScore(metricResults, mode) {
  const values = Object.values(metricResults)
    .map((result) => result.scores?.[mode])
    .filter(Number.isFinite);
  return values.length > 0 ? roundScore(mean(values)) : null;
}

function aggregatePassed(metricResults, mode) {
  return Object.values(metricResults).reduce(
    (totals, result) => {
      totals.count += result.passed?.[mode]?.count ?? 0;
      totals.total += result.passed?.[mode]?.total ?? 0;
      return totals;
    },
    { count: 0, total: 0 }
  );
}

function instanceTitle(instanceId) {
  return String(instanceId).replace("__", " / ");
}

function buildInstances(row, generations, explanations) {
  const instanceIds = new Set();
  for (const metric of metricConfigs) {
    for (const mode of ["base", "audit"]) {
      Object.keys(row.metrics[metric.key]?.[mode]?.raw ?? {}).forEach((instanceId) => instanceIds.add(instanceId));
    }
  }

  return [...instanceIds]
    .sort((a, b) => instanceTitle(a).localeCompare(instanceTitle(b)))
    .map((instanceId) => {
      const metricResults = Object.fromEntries(
        metricConfigs.map((metric) => [metric.key, metricResultForInstance(metric, row, generations, instanceId)])
      );
      const baseScore = aggregateInstanceScore(metricResults, "base");
      const auditScore = aggregateInstanceScore(metricResults, "audit");
      return {
        id: instanceId,
        title: instanceTitle(instanceId),
        scores: {
          base: baseScore,
          audit: auditScore
        },
        delta: Number.isFinite(baseScore) && Number.isFinite(auditScore) ? roundScore(auditScore - baseScore) : null,
        passed: {
          base: aggregatePassed(metricResults, "base"),
          audit: aggregatePassed(metricResults, "audit")
        },
        metrics: metricResults,
        explanation: {
          base: explanationFor(explanations.base, row.id, instanceId),
          audit: explanationFor(explanations.audit, row.id, instanceId)
        }
      };
    });
}

function metricScoresForRow(row, mode) {
  return Object.fromEntries(metricConfigs.map((metric) => [metric.key, roundNullable(row.metrics[metric.key]?.[mode]?.score)]));
}

function buildLeaderboard({ rows, generations, questionBank, explanations, repository, evaluationPath, generationPath, ref, commitSha }) {
  const metricKeys = metricConfigs.map((metric) => metric.key);
  const completeRows = rows.filter((row) => metricKeys.every((key) => Number.isFinite(row.metrics[key]?.base?.score)));
  const includedRows = completeRows.length > 0 ? completeRows : rows;
  const skippedIncomplete = completeRows.length > 0 ? rows.length - completeRows.length : 0;

  const agents = includedRows
    .map((row) => {
      const baseMetricScores = metricScoresForRow(row, "base");
      const auditMetricScores = metricScoresForRow(row, "audit");
      const baseValues = Object.values(baseMetricScores).filter(Number.isFinite);
      const auditValues = Object.values(auditMetricScores).filter(Number.isFinite);
      const baseExplanationScore = baseValues.length > 0 ? roundScore(mean(baseValues)) : null;
      const auditExplanationScore = auditValues.length > 0 ? roundScore(mean(auditValues)) : null;
      const baseScores = {
        explanationScore: baseExplanationScore,
        ...baseMetricScores
      };
      const auditScores = {
        explanationScore: auditExplanationScore,
        ...auditMetricScores
      };
      const deltas = Object.fromEntries(
        ["explanationScore", ...metricKeys].map((key) => [
          key,
          Number.isFinite(baseScores[key]) && Number.isFinite(auditScores[key]) ? roundScore(auditScores[key] - baseScores[key]) : null
        ])
      );

      return {
        id: row.id,
        agent: row.agent,
        framework: row.framework,
        scores: {
          base: baseScores,
          audit: auditScores
        },
        deltas,
        explanationScore: baseExplanationScore,
        ...baseMetricScores,
        instances: buildInstances(row, generations.get(row.id), explanations),
        sourceFiles: [...new Set(row.sourceFiles)].sort()
      };
    })
    .sort((a, b) => Number(b.scores.base.explanationScore ?? 0) - Number(a.scores.base.explanationScore ?? 0) || a.agent.localeCompare(b.agent));

  const commitLabel = commitSha ? ` @ ${commitSha.slice(0, 7)}` : "";
  const skippedNote =
    skippedIncomplete > 0 ? ` ${skippedIncomplete} incomplete agent row${skippedIncomplete === 1 ? " was" : "s were"} omitted.` : "";

  return {
    datasetLabel: `${repository} ${evaluationPath}${commitLabel}`,
    source: {
      repository,
      path: evaluationPath,
      generationPath,
      ref,
      commit: commitSha || null
    },
    explanationsSource: explanations.source,
    scoreModes: [
      { key: "base", label: "Before audit" },
      { key: "audit", label: "After audit" }
    ],
    auditAvailable: agents.some((agent) => Number.isFinite(agent.scores.audit.explanationScore)),
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
    questions: questionBank,
    agents,
    methodology: {
      title: "Methodology",
      body:
        "The build imports evaluation JSON files from results/evaluation, reads statistics.mean for each explanation metric, and averages the four metric means into the Explanation score. Audit mode uses audit-prefixed result files."
    },
    updatePolicy: {
      title: "Update policy",
      body: `Scores refresh from ${repository}/${evaluationPath} whenever the site is rebuilt. Rows require all four base explanation metrics.${skippedNote}`
    }
  };
}

function generationPathFromEvaluationPath(evaluationPath) {
  if (evaluationPath.endsWith("/evaluation")) {
    return `${evaluationPath.slice(0, -"/evaluation".length)}/generation`;
  }
  if (evaluationPath === "results/evaluation") {
    return "results/generation";
  }
  return "results/generation";
}

export async function prepareLeaderboardData(options = {}) {
  const { owner, name, slug } = normalizeRepository(options.repository ?? process.env.EXPLAINBENCH_RESULTS_REPOSITORY);
  const ref = String(options.ref ?? process.env.EXPLAINBENCH_RESULTS_REF ?? "main");
  const evaluationPath = String(options.resultsPath ?? process.env.EXPLAINBENCH_RESULTS_PATH ?? "results/evaluation").replace(/\/+$/, "");
  const generationPath = String(options.generationPath ?? process.env.EXPLAINBENCH_GENERATION_RESULTS_PATH ?? generationPathFromEvaluationPath(evaluationPath)).replace(/\/+$/, "");
  const outputFile = options.outputFile ?? defaultOutputFile;
  const apiBase = `https://api.github.com/repos/${owner}/${name}`;
  const rawBase = `https://raw.githubusercontent.com/${owner}/${name}/${encodeURIComponent(ref)}`;

  const [commitSha, rows] = await Promise.all([
    fetchCommitSha(apiBase, ref),
    collectEvaluationResults({ apiBase, evaluationPath, ref })
  ]);

  const metricKeys = metricConfigs.map((metric) => metric.key);
  const completeRows = rows.filter((row) => metricKeys.every((key) => Number.isFinite(row.metrics[key]?.base?.score)));
  const includedRows = completeRows.length > 0 ? completeRows : rows;
  const includedRunIds = includedRows.map((row) => row.id);

  const [generations, questionBank, explanations] = await Promise.all([
    collectGenerationResults({ apiBase, generationPath, ref, runIds: includedRunIds }),
    collectQuestionBank({ rawBase, runIds: includedRunIds }),
    fetchExplanationBundle(apiBase, ref)
  ]);

  const leaderboard = buildLeaderboard({
    rows,
    generations,
    questionBank,
    explanations,
    repository: slug,
    evaluationPath,
    generationPath,
    ref,
    commitSha
  });

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, `${JSON.stringify(leaderboard, null, 2)}\n`);

  console.log(
    `Prepared ${path.relative(rootDir, outputFile)} from ${slug}/${evaluationPath}` +
      ` (${leaderboard.agents.length} agents${commitSha ? `, ${commitSha.slice(0, 7)}` : ""}).`
  );
}

if (pathToFileURL(process.argv[1] || "").href === import.meta.url) {
  await prepareLeaderboardData();
}
