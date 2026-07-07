import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import * as esbuild from "esbuild";
import ejs from "ejs";
import { minify } from "html-minifier-terser";

const rootDir = process.cwd();
const themeDir = path.join(rootDir, "themes", "explainbench");
const themeAssetsDir = path.join(themeDir, "assets");
const publicDir = path.join(rootDir, "public");
const generatedDir = path.join(rootDir, ".generated");

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function xmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function siteBaseUrl() {
  return String(process.env.EXPLAINBENCH_SITE_URL || "").replace(/\/+$/, "");
}

function pageUrlForHtml(file) {
  const relative = toPosix(path.relative(publicDir, file));
  const route = relative === "index.html" ? "/" : `/${relative.replace(/index\.html$/, "")}`;
  return `${siteBaseUrl()}${route}`;
}

async function listFiles(dir, extensions) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath, extensions)));
    } else if (extensions.includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function generateClientTemplates() {
  const templateDir = path.join(themeDir, "client-templates");
  const files = await listFiles(templateDir, [".ejs"]);
  const entries = [];
  const localNames = {
    "asset-error": ["title", "message", "errors"],
    leaderboard: [
      "leaderboard",
      "metrics",
      "activeMetric",
      "agents",
      "scoreMode",
      "auditAvailable",
      "selectedAgent",
      "selectedInstance",
      "selectedInstanceDetail",
      "detailLoading",
      "detailError",
      "selectedQuestions",
      "selectedExplanation",
      "expandedQuestionKey",
      "questionDetail",
      "questionLoading",
      "questionError",
      "animateScores",
      "icon",
      "formatScore",
      "formatDelta",
      "markdownToHtml",
      "scoreValue",
      "scoreDelta",
      "passLabel",
      "statusClass",
      "attemptClass"
    ],
    "usage-demo": ["demo", "selected", "selectedIndex", "icon"]
  };

  for (const file of files) {
    const name = path.basename(file, ".ejs");
    const source = await fs.readFile(file, "utf8");
    const localsPrelude = `<% const { ${(localNames[name] ?? []).join(", ")} } = locals; %>\n`;
    const compiled = ejs.compile(`${localsPrelude}${source}`, {
      client: true,
      compileDebug: false,
      _with: false,
      localsName: "locals",
      rmWhitespace: true,
      filename: file
    });
    entries.push(`templates[${JSON.stringify(name)}] = ${compiled.toString()};`);
  }

  await fs.mkdir(generatedDir, { recursive: true });
  await fs.writeFile(
    path.join(generatedDir, "client-templates.js"),
    `const templates = {};\n${entries.join("\n")}\n\nexport function renderClientTemplate(name, locals = {}) {\n  const template = templates[name];\n  if (!template) throw new Error(\`Unknown client template: \${name}\`);\n  return template(locals);\n}\n`
  );
}

async function copyStaticAssets() {
  const imageSource = path.join(themeAssetsDir, "img");
  const imageTarget = path.join(publicDir, "assets", "img");
  await fs.rm(imageTarget, { force: true, recursive: true });
  await fs.mkdir(path.dirname(imageTarget), { recursive: true });
  await fs.cp(imageSource, imageTarget, { recursive: true });

  const dataSource = path.join(rootDir, "data");
  const dataTarget = path.join(publicDir, "data");
  await fs.rm(dataTarget, { force: true, recursive: true });
  await fs.mkdir(dataTarget, { recursive: true });
  for (const file of await listFiles(dataSource, [".json"])) {
    const relative = path.relative(dataSource, file);
    if (toPosix(relative) === "leaderboard.json") {
      continue;
    }
    const parsed = JSON.parse(await fs.readFile(file, "utf8"));
    await fs.mkdir(path.dirname(path.join(dataTarget, relative)), { recursive: true });
    await fs.writeFile(path.join(dataTarget, relative), `${JSON.stringify(parsed)}\n`);
  }

  await fs.writeFile(path.join(publicDir, ".nojekyll"), "");
}

async function bundleAssets() {
  await generateClientTemplates();

  await esbuild.build({
    absWorkingDir: rootDir,
    bundle: true,
    entryPoints: [path.join("themes", "explainbench", "assets", "js", "main.js")],
    format: "iife",
    legalComments: "none",
    minify: true,
    outfile: path.join(publicDir, "assets", "js", "main.js"),
    platform: "browser",
    target: ["es2020"]
  });

  await esbuild.build({
    absWorkingDir: rootDir,
    bundle: true,
    entryPoints: [path.join("themes", "explainbench", "assets", "css", "styles.css")],
    external: ["../img/*"],
    legalComments: "none",
    minify: true,
    outfile: path.join(publicDir, "assets", "css", "styles.css"),
    platform: "browser"
  });
}

async function minifyGeneratedHtml() {
  if (!(await pathExists(publicDir))) return;
  const htmlFiles = await listFiles(publicDir, [".html"]);
  await Promise.all(
    htmlFiles.map(async (file) => {
      const html = await fs.readFile(file, "utf8");
      const result = await minify(html, {
        collapseBooleanAttributes: true,
        collapseWhitespace: true,
        decodeEntities: true,
        minifyCSS: true,
        minifyJS: true,
        removeAttributeQuotes: false,
        removeComments: true,
        removeEmptyAttributes: true,
        removeOptionalTags: false,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        sortAttributes: true,
        sortClassName: true,
        useShortDoctype: true
      });
      await fs.writeFile(file, `${result}\n`);
    })
  );
}

async function writeCrawlerFiles() {
  const baseUrl = siteBaseUrl();
  if (!baseUrl) return;

  const htmlFiles = (await listFiles(publicDir, [".html"])).sort();
  const today = new Date().toISOString().slice(0, 10);
  const urlEntries = htmlFiles
    .map((file) => {
      const loc = pageUrlForHtml(file);
      const priority = loc.endsWith("/") && loc === `${baseUrl}/` ? "1.0" : "0.8";
      return [
        "  <url>",
        `    <loc>${xmlEscape(loc)}</loc>`,
        `    <lastmod>${today}</lastmod>`,
        "    <changefreq>weekly</changefreq>",
        `    <priority>${priority}</priority>`,
        "  </url>"
      ].join("\n");
    })
    .join("\n");

  await fs.writeFile(
    path.join(publicDir, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`
  );
  await fs.writeFile(
    path.join(publicDir, "robots.txt"),
    ["User-agent: *", "Allow: /", `Sitemap: ${baseUrl}/sitemap.xml`, ""].join("\n")
  );
}

await copyStaticAssets();
await bundleAssets();
await minifyGeneratedHtml();
await writeCrawlerFiles();

console.log(`Post-built ${toPosix(path.relative(rootDir, publicDir))}/`);
