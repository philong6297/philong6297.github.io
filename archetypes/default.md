---
author: "longlp"
title: "test"
date: "2022-12-31"
slug: []
categories: []
tags:
  - cpp
toc: true
# working dir is current post
bibliography: .bib
csl: ../../../static/ieee.csl
customPage:
  enabled: true
  # working dir is current project
  customJS:
    - js/reorder_refs.js
  customCSS:
    - css/custom.css
# Rmd configurations
link-citations: true
link-bibliography: true
notes-after-punctuation: true
output:
  md_document:
    variant: gfm
    preserve_yaml: true
    number_sections: true
    pandoc_args:
      - --eol=lf
      - --ascii
      - --reference-links
      - --reference-location=block
      - --biblatex
---

```{r setup, echo=FALSE, include=FALSE}
knitr::knit_hooks$set(optipng = knitr::hook_optipng)
knitr::opts_chunk$set(echo = FALSE,
                      collapse = TRUE,
                      comment = "#>",
                      fig.path = "", #  images are stored in the same directory
                      fig.retina = 2, # Control using dpi
                      fig.width = 6,  # generated images
                      fig.pos = "t",  # pdf mode
                      fig.align = "center",
                      dpi = if (knitr::is_latex_output()) 72 else 300,
                      out.width = "100%",
                      dev = "svg",
                      dev.args = list(png = list(type = "cairo-png")),
                      optipng = "-o7 -quiet")
```

# Appendix
# References
