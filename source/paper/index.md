---
title: "ExplainBench: Evaluating Code Explanations from Agents"
layout: paper
label: Paper
icon: file-text
eyebrow: Paper info
heading: Accepted paper details.
subheading: Replace the venue, DOI, PDF, artifact, and citation fields here when the camera-ready metadata is final.
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
