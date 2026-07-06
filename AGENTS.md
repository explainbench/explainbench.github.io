# ExplainBench Website Agent Guide

This repository contains the static GitHub Pages site for ExplainBench. It is a Hexo-based site with custom EJS layouts, bundled browser assets, and JSON-backed interactive components.

## Local Commands

- Install dependencies with `npm install`.
- Build the site with `npm run build`.
- Serve the generated site with `npm run serve`.
- After serving, open `http://127.0.0.1:4173/`.

`npm run build` runs Hexo clean/generate through `build/build.mjs`, then runs `build/postbuild.mjs`.

## Source Layout

- `_config.yml` controls Hexo site config, navigation, brand/footer copy, and the runtime data-file manifest.
- `source/**/*.md` contains human-authored pages with YAML front matter and Markdown body content.
- `themes/explainbench/layout/*.ejs` contains page layouts.
- `themes/explainbench/layout/_components/*.ejs` contains reusable server-rendered EJS components.
- `themes/explainbench/client-templates/*.ejs` contains browser-side EJS templates that are precompiled during build for interactive components.
- `themes/explainbench/assets/css/styles.css` and `themes/explainbench/assets/js/**/*.js` are theme source assets bundled and minified by `build/postbuild.mjs`.
- `data/*.json` contains editable benchmark/demo data copied into `public/data/`.
- `public/` is generated build output.

## Page Authoring

Create pages under `source/` with YAML front matter and Markdown content:

```md
---
title: Artifact
layout: page
icon: box
blocks:
  - template: callout
    title: Artifact status
    body: This component body supports **Markdown**.
  - template: section
    heading: Nested component example
    children:
      - template: card-grid
        columns: 2
        items:
          - title: Dataset
            body: Downloadable benchmark files.
          - title: Evaluator
            body: Reproducible scoring scripts.
---

The Markdown body is rendered as the page content. Raw HTML is also allowed because the site content is author-controlled.
```

Each block maps to `themes/explainbench/layout/_components/<template>.ejs`. Nested `children` are rendered recursively by `themes/explainbench/layout/_partial/render-blocks.ejs`.

## Interactive Data

Runtime data files are configured in `_config.yml`:

```yaml
data_files:
  leaderboard: /data/leaderboard.json
  demo: /data/demo-example.json
```

The `leaderboard` and `usage-demo` EJS components create mount points. Browser JavaScript loads the configured JSON and renders dynamic HTML from precompiled EJS templates in `themes/explainbench/client-templates/`.

When changing interactive data or templates, keep the JSON files valid and run `npm run build` to verify that precompilation and bundling still work.

## Build Output

The post-build step:

1. Copies and minifies JSON and images.
2. Bundles and minifies CSS and JavaScript.
3. Precompiles client EJS templates.
4. Minifies generated HTML.
5. Writes `.nojekyll`.

The final website is generated in `public/`. Prefer editing source files rather than generated output unless explicitly debugging build artifacts.

## Deployment

`.github/workflows/publish-pages.yml` runs on pushes except pushes to `gh-pages`. It builds the site and force-pushes `public/` to the `gh-pages` branch. GitHub Pages should be configured to publish from that branch.
