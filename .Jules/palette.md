## 2024-10-24 - Accessibility: Form Label Associations
**Learning:** The application was missing explicit associations between `label` elements and their corresponding inputs (using the `for` attribute). This is a critical accessibility pattern for screen readers and assistive technologies to correctly identify the purpose of form controls.
**Action:** In future updates or new components, always ensure that `label` elements either wrap their input or use the `for` attribute pointing to the input's `id`.

## 2024-10-24 - Accessibility: Icon-Only Buttons
**Learning:** Buttons with only icons or symbols (like "+" or "🗑") rely on visual context and `title` attributes, which are insufficient for screen reader users and some touch interfaces.
**Action:** Always include an `aria-label` on icon-only buttons to provide a text alternative for non-visual users.
