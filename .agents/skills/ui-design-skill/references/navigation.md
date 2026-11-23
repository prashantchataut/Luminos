# Navigation

There are three kinds of navigation:

- **Visible:** tabs or a top bar.
- **Hidden:** a hamburger menu or a sidebar.
- **Contextual:** links, tags and chips inside the content.

Most products use contextual navigation plus one of the other two.

**Choosing:**

- **Use visible navigation when there are 5 or fewer destinations.** This is the best choice in most cases.
- Use hidden navigation for more than 5 items, and **never more than 7** in one level.
- Mixing them is fine: visible for the main destinations, hidden for the rest.
- **Desktop top nav:** up to 7 items. Beyond that, use a dropdown or a mega-menu.

**Mobile tab bar:**

- At the bottom, full width, **60–84 px tall**, with equal-width cells (4 tabs = 25% each).
- Icon and label centered in each cell.
- The selected tab is highlighted, usually with color. Unselected tabs sit at about 35% opacity.
- **Label all tabs or none.**
- Leave extra bottom height for the iOS home indicator (`env(safe-area-inset-bottom)`).

**Desktop nav:**

- Buttons in the nav (Log in, Sign up) go **last**, at the same font size as the tabs.
- Measure the gap to the button's outer edge, not to its text.
- Web apps may use a fixed vertical sidebar.

**Mobile sidebar:**

- Opens from a hamburger at the top left.
- Behind it, an overlay in a dark primary at 60–70% opacity.
- The panel is white and 70–80% of the screen width.
- Inside the panel, a 20/24 margin and items stacked with gaps from the scale. Don't spread items over the full height.
- Tapping outside closes it.

**Contextual links:** must look clickable (color plus weight, an underline, or a chip). They must never look like plain text.
