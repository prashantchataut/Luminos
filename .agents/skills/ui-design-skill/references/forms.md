# Forms

The goal is the conversion rate, meaning how many users submit the form. Every rule here serves that goal.

**Inputs:**

- A bordered rectangle with a **persistent label** above it. A floating label is fine, but pick one style.
- The width matches the expected input: postal code, CVC and expiry fields are narrow.
- Don't style inputs like cards or buttons. A white field with a shadow and no border is confusing.
- Icons inside a field are fine when they are obvious. A search bar may drop its label.

**Choosing the right control:**

| Need | Control |
|---|---|
| Pick one of 2–4 options | Radio buttons |
| Pick one of 5+ options | Dropdown (chevron on the right); add search for long lists |
| Pick several | Checkboxes |
| A setting that applies instantly, with no submit | Switch |
| An approximate value or range | Slider, plus min/max text fields for precision |

- **Checkboxes and radios:** 24×24 with a hit area of at least 44, and the label is clickable too.

**Input states:** inactive, placeholder, focused, filled, error (with a message), success, disabled.

**Structure:**

- **Single column,** with related fields grouped and a slightly larger gap between groups.
- **5+ fields → split into steps** with progress ("Step 1 of 2").
- **Cut every field you don't need.** Offer social or Apple sign-in where you can.
- **Remind users why the form is worth it:** "Join to get member discounts".
- **Explain sensitive fields** (phone, address) with an info tooltip when the reason isn't obvious.
- **Mark optional fields with "(optional)"** rather than marking required ones with asterisks.

**Validation:**

- Validate inline, right after a field is completed.
- **Never wipe what the user entered** when a submit fails.
