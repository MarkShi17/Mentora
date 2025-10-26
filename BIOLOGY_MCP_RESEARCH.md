# Biology Brain MCP Tool Research

_Date: 2025-10-29_

## Summary

To strengthen the Biology brain, we explored domain-specific Model Context Protocol (MCP) tools that can provide high quality biological visuals and structured reasoning. The objective is to complement Claude’s textual explanations with accurate, ready-to-use diagrams that reflect key life science processes.

## Candidate Tooling

| Tool Idea | Description | Pros | Cons / Notes |
|-----------|-------------|------|--------------|
| **Biology Diagram Generator (matplotlib)** | Procedurally draw canonical cell structures, organelles, and processes using matplotlib primitives (circles, arrows, gradients). | Runs fully offline, deterministic output, easy to extend, aligns with existing Python MCP. | Requires handcrafted templates; best for high-level schematics rather than photorealistic imagery. |
| **Pathway Graph Renderer (networkx + matplotlib)** | Build metabolic / signaling pathways from pre-defined templates, render with networkx. | Great for flow-based diagrams; integrates well with graph libraries. | Needs curated datasets; pathway coverage limited unless extended. |
| **Protein Ribbon Snapshot (Biopython / Py3Dmol)** | Generate quick ribbon plots from PDB IDs. | Provides structural biology visuals. | Requires larger dependencies and potentially GPU if expanded; adds download latency. |
| **AlphaFold / ESMFold MCP** | Call out to structure prediction services. | High value for novel proteins. | Heavy compute / external API reliance; unsuitable without stable hosting. |
| **Pathway Illustration Services (e.g., KEGG, BioRender)** | Fetch curated diagrams. | Professional-quality visuals. | Licensing and network access requirements prevent turnkey integration. |

## Selected Approach

We prioritized a lightweight, offline-capable solution and extended the existing Python MCP server with a new `render_biology_diagram` tool. This tool ships with handcrafted templates for:

- **Cell structure overview** – membranes, nucleus, mitochondria, ribosomes.
- **DNA transcription** – illustrates DNA template, RNA polymerase, and mRNA strand.
- **Photosynthesis process** – highlights chloroplast components and light/dark reactions.

The approach keeps dependencies minimal while giving mentors reliable, annotation-ready schematics that can be refined over time with additional templates or data-driven overlays.

## Future Enhancements

- Add networkx-backed pathway diagrams (glycolysis, Krebs cycle).
- Support user-specified labels / highlight regions via arguments.
- Incorporate protein structure renders through optional Py3Dmol integration.
- Offer animated variants via the Manim MCP once biology-centric scenes are available.
