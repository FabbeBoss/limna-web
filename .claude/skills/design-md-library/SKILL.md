---
name: design-md-library
description: Library of 84 DESIGN.md files (design-system write-ups of well-known sites: colors, type scale, spacing, components, motion) from VoltAgent/awesome-design-md. Use when you want a reference for how a polished site structures its design system, when writing or updating Limna's own DESIGN.md, or when the user says "make it feel like <site>".
---

# DESIGN.md library

`references/<site>/DESIGN.md` holds one plain-markdown design system per site (YAML front matter with
color and type tokens, then prose rules for layout, components and motion). Sites include apple, airbnb,
stripe, linear.app, vercel, notion, figma, framer, webflow, spacex, tesla, nike, spotify and ~70 more:
`ls references/` lists them all.

## How to use it for Limna

1. Pick 1–3 references whose *feel* matches the ask. Read only those files; they are long.
2. Borrow structure and principles (how they set a type scale, spacing rhythm, motion rules, contrast),
   never a brand's identity: no copying their logos, names, exact palettes or proprietary fonts onto limna.se.
3. Limna's own direction still wins: a still camera on a field, time of day passing on scroll, heavy type
   directly on the scene, no boxes/cards, no heavy shading, no generic fonts (see project memory).
4. If asked to write Limna's own design system, save it as `DESIGN.md` in the repo root, using the same
   section layout as these files.

Source: https://github.com/VoltAgent/awesome-design-md (commit fcc7028), MIT, see `LICENSE`.
Some `references/<site>/README.md` files only point to getdesign.md; the `DESIGN.md` next to them is the content.
