---
title: ExplainBench
seoTitle: "ExplainBench | Benchmarking Code Explanation Fidelity"
description: ExplainBench is a research benchmark for evaluating whether coding-agent explanations are informative, grounded, and faithful to patch behavior.
keywords:
  - ExplainBench
  - code explanations
  - coding agents
  - benchmark
  - explanation fidelity
image: /assets/img/explainbench-hero.png
layout: intro
icon: sparkles
hero:
  eyebrow: Research benchmark for code explanations
  title: ExplainBench
  subtitle: Evaluate whether coding-agent explanations are informative, grounded in program behavior, and faithful to the patches they describe.
  actions:
    - label: View leaderboard
      href: /leaderboard/
      icon: bar-chart-3
    - label: Try demo
      href: /usage/
      icon: terminal
      variant: secondary
  terminal:
    - explainbench evaluate --agent {bestAgent}
    - "loading questions: intent/effect x global/local"
    - scoring explanations from preloaded JSON assets
  stats:
    - value: "4"
      label: question families
    - value: "297"
      label: benchmark instances in paper draft
    - value: "5"
      label: evaluated agent frameworks
blocks:
  - template: card-grid
    eyebrow: Evaluation surface
    heading: Turn explanations into measurable artifacts.
    subheading: ExplainBench converts natural-language patch explanations into objective QA tasks, so explanation quality can be compared independently from patch success.
    columns: 3
    items:
      - label: Intent
        title: What should the program do?
        body: Intent questions test whether an explanation conveys the developer-intended behavior behind a bug fix.
      - label: Effect
        title: What did the patch actually change?
        body: Effect questions test whether the explanation matches execution evidence before and after the agent patch.
      - label: Granularity
        title: Global and local reasoning
        body: The benchmark separates end-to-end program behavior from function-level behavior to reveal where explanations lose precision.
  - template: flow-steps
    eyebrow: Benchmark pipeline
    heading: From patch explanations to comparable scores.
    subheading: The workflow combines behavioral traces, generated questions, and explanation-only answering to expose when an agent sounds plausible but misses the real patch effect.
    items:
      - title: Collect traces
        body: Gather developer tests, developer patches, agent patches, and final agent explanations.
      - title: Build questions
        body: Derive multiple-choice questions about intended behavior and actual patch effects.
      - title: Answer from explanation
        body: Ask a QA model to answer only from the agent explanation and benchmark context.
      - title: Score and audit
        body: Compare answers to ground truth and surface explanation gaps for improvement.
---

ExplainBench treats explanations as review artifacts: they should help developers understand intent, evidence, and patch effects without trusting surface-level fluency.
