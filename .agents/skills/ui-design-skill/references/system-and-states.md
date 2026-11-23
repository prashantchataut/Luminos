# Consistency, design system, screens to deliver, process

## Consistency and the design system

### Internal consistency

- **Visual:** the same color, type, size, radius and shadow for the same role on every screen.
- **Functional:** the same control always does the same thing. Breaking functional consistency is the most damaging kind, because it destroys learnability.

### External consistency

- **Follow platform behavior,** as described in the iOS Human Interface Guidelines and Material Design: how switches toggle, how the keyboard opens from a text field, how back works.
- **Visual identity is where you stand out:** typeface, brand colors, logo and imagery.
- **Keep patterns familiar.** Make the product innovative, not the interface patterns.

### Design system

- **Structure:**
  - **Atoms:** tokens such as colors, type styles, icons and labels.
  - **Molecules:** buttons, inputs, checkboxes, the tab bar, toasts, breadcrumbs.
  - **Organisms:** cards, forms, complex nav.
- **Extract it from real screens.** Don't invent styles the UI never uses.
- **Name by role**, such as "Primary button – Large" (never "the big blue button"). Document each style's specs, for example "H1 – 32 / Bold / LS −3% / LH 36".
- **Show every state** of every component.
- **Write guidelines specific to the product,** such as "used outdoors in sunlight: maximize contrast". Skip generic truisms.
- **Done test:** if every screen were deleted, could you rebuild them all from the system alone?

### Screens to deliver (not just the happy path)

- Empty states: an illustration or icon, short copy and an action button, such as "Nothing to see here! Tasks you create will appear here."
- Loading states: a skeleton or a spinner.
- Error states, and success confirmations.
- A 404 page, with a way home and optionally a search.
- Every breakpoint you support.
- Data edge cases: very long names, missing images, zero items, many items.

## Process (when designing from scratch)

1. **Understand the problem.** Write down the goal and how you will measure success.
2. **Explore several rough layouts.** Quantity beats polish at this stage.
3. **Build the structure as a detailed grayscale wireframe**, then validate the solution before styling it.
4. **Choose the assets:** typeface, palette, icon pack, photo or illustration style, all following the personality.
5. **Apply the assets** to the wireframe.
6. **Explain each decision** by pointing to the goal, not to taste. For example: "this card is large so it is more prominent and easier to tap."
