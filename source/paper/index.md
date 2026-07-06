---
title: "ExplainBench: Evaluating Code Explanations from Agents"
seoTitle: "ExplainBench Paper | Evaluating Code Explanations from Agents"
description: Read the ExplainBench paper summary, authors, abstract, citation, and artifact links for the benchmark evaluating coding-agent explanations.
keywords:
  - ExplainBench paper
  - code explanation benchmark
  - agent explanations
  - software engineering research
image: /assets/img/explainbench-hero.png
layout: paper
label: Paper
icon: file-text
eyebrow: Paper info
heading: Paper, artifact, and citation.
subheading: Camera-ready metadata, PDF, and artifact links can be updated here as the public release stabilizes.
authors:
  - Zhiyuan Pan
  - Sungmin Kang
  - Imam Nur Bani Yusuf
  - Abhik Roychoudury
contributions:
  - title: Benchmark
    body: ExplainBench automatically evaluates agent explanation quality through grounded question answering.
  - title: Finding
    body: Patch-generation efficacy and explanation quality can diverge, so explanation quality needs independent evaluation.
  - title: Audit agent
    body: ExplanationAuditAgent uses differential tests and call-graph evidence to refine agent explanations.
  - title: Extensibility
    body: The benchmark is designed so new explanation criteria and question families can be added.
metaHeading: Metadata
metadata:
  - key: Status
    value: Accepted paper
  - key: Venue
    value: To be updated
  - key: Artifact
    value: Placeholder link
  - key: Last site data update
    value: "2026-07-07"
datePublished: "2026"
linksHeading: Links
links:
  - label: Paper PDF
    href: "#"
    icon: file-text
  - label: Code
    href: "#"
    icon: github
  - label: Artifact
    href: "#"
    icon: box
bibtex: |
  @inproceedings{pan2026explainbench,
    title = {ExplainBench: Evaluating Code Explanations from Agents},
    author = {Pan, Zhiyuan and Kang, Sungmin and Yusuf, Imam Nur Bani and Roychoudury, Abhik},
    booktitle = {To appear},
    year = {2026}
  }
---

## Abstract

Large language model agents increasingly generate substantial code changes, making trustworthy explanations important for developer review. ExplainBench evaluates whether agent-generated explanations contain enough information for an LLM to answer objective questions about buggy behavior and patch effects.
