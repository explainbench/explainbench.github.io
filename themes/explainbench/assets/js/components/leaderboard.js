import { renderClientTemplate } from "../../../../../.generated/client-templates.js";
import { formatScore, icon, markdownToHtml } from "../html.js";

function readEmbeddedLeaderboard(root) {
  const node = root.querySelector("[data-leaderboard-json]");
  if (!node?.textContent) return null;
  try {
    return JSON.parse(node.textContent);
  } catch {
    return null;
  }
}

const leaderboardStates = new WeakMap();

function stateFor(root) {
  const existing = leaderboardStates.get(root);
  if (existing) return existing;
  const state = {
    instanceDetails: new Map(),
    instancePromises: new Map(),
    instanceErrors: new Map(),
    questionDetails: new Map(),
    questionPromises: new Map(),
    questionErrors: new Map(),
    topButtonAbort: null
  };
  leaderboardStates.set(root, state);
  return state;
}

async function fetchDetail(path, version = "") {
  const url = new URL(path, document.baseURI);
  if (version) {
    url.searchParams.set("v", version);
  }
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
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

function selectedQuestionsFor(selectedInstanceDetail) {
  return selectedInstanceDetail?.questions ?? [];
}

function selectedExplanationFor(selectedInstanceDetail, mode) {
  const current = selectedInstanceDetail?.explanation?.[mode];
  if (current?.text) {
    return {
      ...current,
      label: mode === "audit" ? "Audit explanation" : "Base explanation"
    };
  }

  const fallback = selectedInstanceDetail?.explanation?.base;
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

function scrollBehavior() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function scrollToElement(element, offset = 88) {
  if (!element) return;
  const top = Math.max(0, element.getBoundingClientRect().top + window.scrollY - offset);
  window.scrollTo({ top, behavior: scrollBehavior() });
}

function scrollToQuestion(root, questionKey) {
  window.requestAnimationFrame(() => {
    const card = [...root.querySelectorAll("[data-toggle-question-key]")].find(
      (element) => element.dataset.toggleQuestionKey === questionKey
    );
    card?.focus({ preventScroll: true });
    scrollToElement(card);
  });
}

function renderLeaderboard(root, leaderboard, { refreshIcons, animateScores = false } = {}) {
  const state = stateFor(root);
  state.topButtonAbort?.abort();
  state.topButtonAbort = null;
  const metrics = leaderboard.metrics ?? [];
  const activeMetric = metrics.find((metric) => metric.key === root.dataset.metric) ?? metrics[0];
  const metricKey = activeMetric?.key;
  const auditAvailable = Boolean(leaderboard.auditAvailable);
  const scoreMode = root.dataset.scoreMode === "audit" && auditAvailable ? "audit" : "base";
  root.dataset.scoreMode = scoreMode;

  const agents = sortAgents(leaderboard, metricKey, scoreMode);
  const selectedAgent = leaderboard.agents?.find((agent) => agent.id === root.dataset.agentId) ?? null;
  const selectedInstance = selectedAgent?.instances?.find((instance) => instance.id === root.dataset.instanceId) ?? null;
  const detailVersion = leaderboard.detailVersion || leaderboard.source?.commit || "";

  let selectedInstanceDetail = null;
  let detailLoading = false;
  let detailError = "";
  if (selectedInstance?.detailPath) {
    selectedInstanceDetail = state.instanceDetails.get(selectedInstance.detailPath) ?? null;
    detailError = state.instanceErrors.get(selectedInstance.detailPath) ?? "";
    detailLoading = state.instancePromises.has(selectedInstance.detailPath);
    if (!selectedInstanceDetail && !detailLoading && !detailError) {
      const promise = fetchDetail(selectedInstance.detailPath, detailVersion)
        .then((detail) => {
          state.instanceDetails.set(selectedInstance.detailPath, detail);
          state.instanceErrors.delete(selectedInstance.detailPath);
        })
        .catch((error) => {
          state.instanceErrors.set(selectedInstance.detailPath, error.message || "Failed to load instance detail.");
        })
        .finally(() => {
          state.instancePromises.delete(selectedInstance.detailPath);
          renderLeaderboard(root, leaderboard, { refreshIcons });
          refreshIcons?.();
        });
      state.instancePromises.set(selectedInstance.detailPath, promise);
      detailLoading = true;
    }
  }

  const selectedQuestions = selectedQuestionsFor(selectedInstanceDetail);
  const selectedExplanation = selectedExplanationFor(selectedInstanceDetail, scoreMode);
  const expandedQuestionKey = root.dataset.questionKey ?? "";
  const expandedQuestion = selectedQuestions.find((item) => item.metric?.key === expandedQuestionKey) ?? null;
  const expandedQuestionPath = expandedQuestion?.question?.detailsPath;
  let questionDetail = null;
  let questionLoading = false;
  let questionError = "";
  if (expandedQuestionPath) {
    questionDetail = state.questionDetails.get(expandedQuestionPath) ?? null;
    questionError = state.questionErrors.get(expandedQuestionPath) ?? "";
    questionLoading = state.questionPromises.has(expandedQuestionPath);
    if (!questionDetail && !questionLoading && !questionError) {
      const promise = fetchDetail(expandedQuestionPath, detailVersion)
        .then((detail) => {
          state.questionDetails.set(expandedQuestionPath, detail);
          state.questionErrors.delete(expandedQuestionPath);
        })
        .catch((error) => {
          state.questionErrors.set(expandedQuestionPath, error.message || "Failed to load question detail.");
        })
        .finally(() => {
          state.questionPromises.delete(expandedQuestionPath);
          renderLeaderboard(root, leaderboard, { refreshIcons });
          refreshIcons?.();
          if (root.dataset.questionKey === expandedQuestionKey) {
            scrollToQuestion(root, expandedQuestionKey);
          }
        });
      state.questionPromises.set(expandedQuestionPath, promise);
      questionLoading = true;
    }
  }

  root.innerHTML = renderClientTemplate("leaderboard", {
    leaderboard,
    metrics,
    activeMetric,
    agents,
    scoreMode,
    auditAvailable,
    selectedAgent,
    selectedInstance,
    selectedInstanceDetail,
    detailLoading,
    detailError,
    selectedQuestions,
    selectedExplanation,
    expandedQuestionKey,
    questionDetail,
    questionLoading,
    questionError,
    animateScores,
    icon,
    formatScore,
    formatDelta,
    markdownToHtml,
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
    renderLeaderboard(root, leaderboard, { refreshIcons, animateScores: true });
    refreshIcons?.();
  });

  root.querySelectorAll("[data-open-agent-id]").forEach((row) => {
    const openAgent = () => {
      root.dataset.agentId = row.dataset.openAgentId;
      delete root.dataset.instanceId;
      delete root.dataset.questionKey;
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
    delete root.dataset.questionKey;
    renderLeaderboard(root, leaderboard, { refreshIcons });
    refreshIcons?.();
  });

  const topButton = root.querySelector("[data-agent-top]");
  if (topButton) {
    const controller = new AbortController();
    state.topButtonAbort = controller;
    const rootTop = root.getBoundingClientRect().top + window.scrollY;
    const revealDistance = Math.min(620, Math.max(420, window.innerHeight * 0.65));
    const threshold = rootTop + revealDistance;
    const updateTopButton = () => {
      topButton.classList.toggle("is-visible", window.scrollY > threshold);
    };

    updateTopButton();
    window.addEventListener("scroll", updateTopButton, { passive: true, signal: controller.signal });
    topButton.addEventListener(
      "click",
      () => {
        scrollToElement(root.querySelector(".agent-view") ?? root);
      },
      { signal: controller.signal }
    );
  }

  root.querySelectorAll("[data-select-instance-id]").forEach((button) => {
    button.addEventListener("click", () => {
      root.dataset.instanceId = button.dataset.selectInstanceId;
      delete root.dataset.questionKey;
      renderLeaderboard(root, leaderboard, { refreshIcons });
      refreshIcons?.();
    });
  });

  root.querySelectorAll("[data-toggle-question-key]").forEach((card) => {
    const toggleQuestion = () => {
      let nextQuestionKey = "";
      if (root.dataset.questionKey === card.dataset.toggleQuestionKey) {
        delete root.dataset.questionKey;
      } else {
        nextQuestionKey = card.dataset.toggleQuestionKey;
        root.dataset.questionKey = nextQuestionKey;
      }
      renderLeaderboard(root, leaderboard, { refreshIcons });
      refreshIcons?.();
      if (nextQuestionKey) {
        scrollToQuestion(root, nextQuestionKey);
      }
    };
    card.addEventListener("click", toggleQuestion);
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleQuestion();
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
