import { renderClientTemplate } from "../../../../../.generated/client-templates.js";
import { icon } from "../html.js";

export function hydrateUsageDemo(root, demo, { refreshIcons } = {}) {
  if (!demo?.examples?.length) {
    root.innerHTML = renderClientTemplate("asset-error", {
      title: "Usage demo data is unavailable."
    });
    return;
  }

  const selectedIndex = Number(root.dataset.selectedDemo ?? 0);
  const selected = demo.examples[selectedIndex] ?? demo.examples[0];

  root.innerHTML = renderClientTemplate("usage-demo", {
    demo,
    selected,
    selectedIndex,
    icon
  });

  root.querySelectorAll("[data-demo-select]").forEach((select) => {
    select.addEventListener("change", () => {
      root.dataset.selectedDemo = Number(select.value);
      hydrateUsageDemo(root, demo, { refreshIcons });
      refreshIcons?.();
    });
  });

  root.querySelectorAll("[data-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-question]");
      const status = card.querySelector("[data-status]");
      const expected = button.dataset.answer;
      const label = button.querySelector("strong").textContent.replace(".", "").trim();

      card.querySelectorAll("[data-choice]").forEach((choiceButton) => {
        choiceButton.classList.remove("is-correct", "is-wrong");
      });

      if (label === expected) {
        button.classList.add("is-correct");
        status.textContent = "Correct. This explanation supports the grounded answer.";
      } else {
        button.classList.add("is-wrong");
        const correct = [...card.querySelectorAll("[data-choice]")].find((choiceButton) =>
          choiceButton.querySelector("strong").textContent.startsWith(expected)
        );
        correct?.classList.add("is-correct");
        status.textContent = `Not this one. The grounded answer is ${expected}.`;
      }
    });
  });
}
