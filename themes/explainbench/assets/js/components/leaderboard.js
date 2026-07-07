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

export function hydrateLeaderboard(root, providedLeaderboard, { refreshIcons } = {}) {
  const leaderboard = providedLeaderboard ?? readEmbeddedLeaderboard(root);
  if (!leaderboard) {
    root.innerHTML = renderClientTemplate("asset-error", {
      title: "Leaderboard data is unavailable."
    });
    return;
  }

  const metrics = leaderboard.metrics ?? [];
  const activeMetric = metrics.find((metric) => metric.key === root.dataset.metric) ?? metrics[0];
  const metricKey = activeMetric?.key;
  const agents = [...(leaderboard.agents ?? [])].sort((a, b) => Number(b[metricKey] ?? 0) - Number(a[metricKey] ?? 0));

  root.innerHTML = renderClientTemplate("leaderboard", {
    leaderboard,
    metrics,
    activeMetric,
    agents,
    icon,
    formatScore
  });

  root.querySelectorAll("[data-metric]").forEach((button) => {
    button.addEventListener("click", () => {
      root.dataset.metric = button.dataset.metric;
      hydrateLeaderboard(root, leaderboard, { refreshIcons });
      refreshIcons?.();
    });
  });
}
