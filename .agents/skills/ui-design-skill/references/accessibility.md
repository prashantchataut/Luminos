# Accessibility

Accessibility applies to every product. Disabilities can be permanent, temporary (a broken arm) or situational (a parent holding a baby, bright sunlight).

- **Contrast:**
  - Check every text and UI element. The book's examples: 1.28:1 fails, 10.25:1 reaches AAA.
  - **(WCAG)** AA requires 4.5:1 for body text and 3:1 for large text (18.66 px bold or 24 px and up) and for UI components.
- **Never color alone:** errors, success states and links also get an icon and/or text, or extra weight or an underline.
- **Text:**
  - At least 10 px, preferably 12 px or more.
  - No Light weight at small sizes.
  - Consider a serif for long reading.
- **Targets:** at least 44×44 on mobile (24×24 fails), and the same is good practice on desktop.
- **Images and media:**
  - Meaningful images get descriptive alt text ("A white birch stool on a light-blue background").
  - Decorative images get `alt=""`.
  - Videos get captions and audio gets transcripts.
  - Compress assets for slow connections.
- **(convention)** Visible focus states, keyboard operability and semantic HTML.
