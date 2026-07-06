import { renderClientTemplate } from "../../../../../.generated/client-templates.js";
import { formatScore, icon } from "../html.js";

export function hydrateLeaderboard(root, leaderboard, { refreshIcons } = {}) {
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
