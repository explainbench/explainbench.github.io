import {
  Activity,
  ArrowLeft,
  Award,
  BarChart3,
  Box,
  CheckCircle2,
  Circle,
  Copy,
  Crosshair,
  Database,
  FileText,
  GitCompareArrows,
  Github,
  Moon,
  Medal,
  Sparkles,
  Sun,
  SunMoon,
  Target,
  Terminal,
  Wrench,
  createIcons
} from "lucide";
import { renderClientTemplate } from "../../../../.generated/client-templates.js";
import { hydrateHero } from "./components/hero.js";
import { hydrateLeaderboard } from "./components/leaderboard.js";
import { hydrateUsageDemo } from "./components/usage-demo.js";
import { loadSiteData } from "./data-loader.js";

const app = document.querySelector("#app");
const themeStorageKey = "explainbench-theme";
const systemThemeQuery = window.matchMedia?.("(prefers-color-scheme: dark)");

const hydrators = {
  hero: hydrateHero,
  leaderboard: hydrateLeaderboard,
  "usage-demo": hydrateUsageDemo
};

const lucideIcons = {
  Activity,
  ArrowLeft,
  Award,
  BarChart3,
  Box,
  CheckCircle2,
  Circle,
  Copy,
  Crosshair,
  Database,
  FileText,
  GitCompareArrows,
  Github,
  Moon,
  Medal,
  Sparkles,
  Sun,
  SunMoon,
  Target,
  Terminal,
  Wrench
};

function refreshIcons() {
  createIcons({ icons: lucideIcons });
}

function readStoredTheme() {
  try {
    const value = localStorage.getItem(themeStorageKey);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function writeStoredTheme(theme) {
  try {
    localStorage.setItem(themeStorageKey, theme);
  } catch {
    // Theme switching still works for the current page when storage is unavailable.
  }
}

function resolveSystemTheme() {
  return systemThemeQuery?.matches ? "dark" : "light";
}

function setTheme(theme, source) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themeSource = source;
}

function currentTheme() {
  return document.documentElement.dataset.theme || readStoredTheme() || resolveSystemTheme();
}

function updateThemeButton() {
  const button = document.querySelector("[data-theme-toggle]");
  if (!button) return;

  const theme = currentTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";
  const label = theme === "dark" ? "Dark" : "Light";
  const icon = theme === "dark" ? "moon" : "sun";
  const source = document.documentElement.dataset.themeSource === "system" ? "system" : "saved";

  button.dataset.theme = theme;
  button.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
  button.setAttribute("title", `${label} mode (${source})`);
  button.querySelector("[data-theme-label]").textContent = label;
  button.querySelector("[data-theme-icon]").innerHTML = `<i data-lucide="${icon}" aria-hidden="true"></i>`;
}

function wireThemeToggle() {
  const stored = readStoredTheme();
  setTheme(stored || resolveSystemTheme(), stored ? "manual" : "system");
  updateThemeButton();

  document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
    const nextTheme = currentTheme() === "dark" ? "light" : "dark";
    writeStoredTheme(nextTheme);
    setTheme(nextTheme, "manual");
    updateThemeButton();
    refreshIcons();
  });

  systemThemeQuery?.addEventListener("change", () => {
    if (readStoredTheme()) return;
    setTheme(resolveSystemTheme(), "system");
    updateThemeButton();
    refreshIcons();
  });
}

function showAssetErrors(errors) {
  if (!errors.length) return;
  app.insertAdjacentHTML(
    "afterbegin",
    renderClientTemplate("asset-error", {
      title: "Some content assets did not load.",
      message: "The page shell is still available. Check that the JSON files are present and that the site is served over HTTP.",
      errors
    })
  );
}

function hydrateComponents(data) {
  app.querySelectorAll("[data-component]").forEach((root) => {
    const hydrator = hydrators[root.dataset.component];
    if (!hydrator) return;
    const dataKey = root.dataset.dataKey;
    hydrator(root, dataKey ? data?.[dataKey] : null, { data, refreshIcons });
  });
}

function dataKeysForPage() {
  return [...new Set([...app.querySelectorAll("[data-component][data-data-key]")].map((root) => root.dataset.dataKey).filter(Boolean))];
}

function wireGenericInteractions() {
  document.querySelectorAll("[data-copy-target]").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = document.getElementById(button.dataset.copyTarget);
      if (!target || !navigator.clipboard) return;
      await navigator.clipboard.writeText(target.textContent);
      button.setAttribute("aria-label", "Copied");
      setTimeout(() => button.setAttribute("aria-label", "Copy BibTeX"), 1400);
    });
  });
}

function wireRevealAnimations() {
  const targets = [...document.querySelectorAll(
    [
      ".hero .kicker",
      ".hero h1",
      ".hero-lede",
      ".hero-actions",
      ".terminal-card",
      ".markdown-card",
      ".section-head",
      ".card",
      ".leaderboard-table-wrap",
      ".demo-panel"
    ].join(",")
  )].filter((element) => !element.dataset.revealBound);

  if (!targets.length) return;

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  targets.forEach((element, index) => {
    element.dataset.reveal = "";
    element.dataset.revealBound = "true";
    element.style.setProperty("--reveal-delay", `${Math.min(index % 6, 5) * 45}ms`);
    if (getComputedStyle(element).display === "none") {
      element.classList.add("is-visible");
    }
  });

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    targets.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px 120px 0px", threshold: 0.01 }
  );

  targets.forEach((element) => observer.observe(element));
}

wireThemeToggle();

loadSiteData(dataKeysForPage())
  .then(({ data, errors }) => {
    showAssetErrors(errors);
    hydrateComponents(data);
    wireGenericInteractions();
    wireRevealAnimations();
    refreshIcons();
  })
  .catch((error) => {
    showAssetErrors([error.message]);
    wireRevealAnimations();
    refreshIcons();
  });
