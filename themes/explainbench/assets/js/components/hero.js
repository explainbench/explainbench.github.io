export function hydrateHero(root, data) {
  const bestAgent = data?.agents?.[0]?.agent ?? "demo-agent";
  root.querySelectorAll("[data-best-agent-template]").forEach((node) => {
    node.textContent = node.textContent.replace("{bestAgent}", bestAgent);
  });
}
