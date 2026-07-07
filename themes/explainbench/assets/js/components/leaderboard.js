import { renderClientTemplate } from "../../../../../.generated/client-templates.js";
import { formatScore, icon } from "../html.js";

function readEmbeddedLeaderboard(root) {
  const node = root.querySelector("[data-leaderboard-json]");
  if (!node?.textContent) return null;
  try {
    return JSON.parse(node.textContent);
  } catch {
    return null;
  }
}

function scoreValue(agent, metricKey, mode) {
  return Number(agent?.scores?.[mode]?.[metricKey] ?? agent?.[metricKey] ?? 0);
}

function scoreDelta(agent, metricKey) {
  const value = Number(agent?.deltas?.[metricKey]);
  return Number.isFinite(value) ? value : null;
}

function formatDelta(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(3)}`;
}

function passLabel(stat) {
  if (!stat?.total) return "n/a";
  return `${stat.count}/${stat.total}`;
}

function statusClass(item, mode = "base") {
  const stat = item?.passed?.[mode] ?? item;
  if (!stat?.total) return "is-missing";
  if (stat.count === stat.total) return "is-pass";
  if (stat.count === 0) return "is-fail";
  return "is-partial";
}

function attemptClass(attempt) {
  if (attempt?.correct === true) return "is-pass";
  if (attempt?.correct === false) return "is-fail";
  return "is-missing";
}

function sortAgents(leaderboard, metricKey, mode) {
  return [...(leaderboard.agents ?? [])].sort((a, b) => {
    const difference = scoreValue(b, metricKey, mode) - scoreValue(a, metricKey, mode);
    return difference || String(a.agent ?? "").localeCompare(String(b.agent ?? ""));
  });
}

function questionForMetric(leaderboard, agentId, instanceId, metricKey) {
  return (
    leaderboard.questions?.shared?.[metricKey]?.[instanceId] ??
    leaderboard.questions?.byRun?.[agentId]?.[metricKey]?.[instanceId] ??
    null
  );
}

function selectedQuestionsFor(leaderboard, metrics, selectedAgent, selectedInstance) {
  if (!selectedAgent || !selectedInstance) return [];
  return metrics
    .filter((metric) => metric.key !== "explanationScore")
    .map((metric) => ({
      metric,
      result: selectedInstance.metrics?.[metric.key] ?? null,
      question: questionForMetric(leaderboard, selectedAgent.id, selectedInstance.id, metric.key)
    }));
}

function selectedExplanationFor(selectedInstance, mode) {
  const current = selectedInstance?.explanation?.[mode];
  if (current?.text) {
    return {
      ...current,
      label: mode === "audit" ? "Audit explanation" : "Base explanation"
    };
  }

  const fallback = selectedInstance?.explanation?.base;
  if (fallback?.text) {
    return {
      ...fallback,
      label: "Base explanation"
    };
  }

  return {
    text: "No explanation text is available for this instance.",
    truncated: false,
    label: "Explanation"
  };
}

function renderLeaderboard(root, leaderboard, { refreshIcons } = {}) {
  const metrics = leaderboard.metrics ?? [];
  const activeMetric = metrics.find((metric) => metric.key === root.dataset.metric) ?? metrics[0];
  const metricKey = activeMetric?.key;
  const auditAvailable = Boolean(leaderboard.auditAvailable);
  const scoreMode = root.dataset.scoreMode === "audit" && auditAvailable ? "audit" : "base";
  root.dataset.scoreMode = scoreMode;

  const agents = sortAgents(leaderboard, metricKey, scoreMode);
  const selectedAgent = leaderboard.agents?.find((agent) => agent.id === root.dataset.agentId) ?? null;
  const selectedInstance =
    selectedAgent?.instances?.find((instance) => instance.id === root.dataset.instanceId) ??
    selectedAgent?.instances?.[0] ??
    null;

  if (selectedAgent && selectedInstance) {
    root.dataset.instanceId = selectedInstance.id;
  }

  const selectedQuestions = selectedQuestionsFor(leaderboard, metrics, selectedAgent, selectedInstance);
  const selectedExplanation = selectedExplanationFor(selectedInstance, scoreMode);

  root.innerHTML = renderClientTemplate("leaderboard", {
    leaderboard,
    metrics,
    activeMetric,
    agents,
    scoreMode,
    auditAvailable,
    selectedAgent,
    selectedInstance,
    selectedQuestions,
    selectedExplanation,
    icon,
    formatScore,
    formatDelta,
    scoreValue,
    scoreDelta,
    passLabel,
    statusClass,
    attemptClass
  });

  root.querySelectorAll("[data-sort-metric]").forEach((button) => {
    button.addEventListener("click", () => {
      root.dataset.metric = button.dataset.sortMetric;
      renderLeaderboard(root, leaderboard, { refreshIcons });
      refreshIcons?.();
    });
  });

  root.querySelector("[data-audit-toggle]")?.addEventListener("change", (event) => {
    root.dataset.scoreMode = event.currentTarget.checked ? "audit" : "base";
    renderLeaderboard(root, leaderboard, { refreshIcons });
    refreshIcons?.();
  });

  root.querySelectorAll("[data-open-agent-id]").forEach((row) => {
    const openAgent = () => {
      root.dataset.agentId = row.dataset.openAgentId;
      delete root.dataset.instanceId;
      renderLeaderboard(root, leaderboard, { refreshIcons });
      refreshIcons?.();
    };
    row.addEventListener("click", openAgent);
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openAgent();
    });
  });

  root.querySelector("[data-leaderboard-back]")?.addEventListener("click", () => {
    delete root.dataset.agentId;
    delete root.dataset.instanceId;
    renderLeaderboard(root, leaderboard, { refreshIcons });
    refreshIcons?.();
  });

  root.querySelectorAll("[data-select-instance-id]").forEach((button) => {
    button.addEventListener("click", () => {
      root.dataset.instanceId = button.dataset.selectInstanceId;
      renderLeaderboard(root, leaderboard, { refreshIcons });
      refreshIcons?.();
    });
  });
}

export function hydrateLeaderboard(root, providedLeaderboard, { refreshIcons } = {}) {
  const leaderboard = providedLeaderboard ?? readEmbeddedLeaderboard(root);
  if (!leaderboard) {
    root.innerHTML = renderClientTemplate("asset-error", {
      title: "Leaderboard data is unavailable."
    });
    return;
  }

  renderLeaderboard(root, leaderboard, { refreshIcons });
}
