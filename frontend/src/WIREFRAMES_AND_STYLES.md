# Wireframes & Styles Reference (UI Polish Package)

This doc captures the target layout, theme, and component styles from the **Complete UI Polish Package** so the app matches the intended wireframes and design.

---

## 1. Global theme (createAppTheme)

- **Palette (light)**
  - `background.default`: `#f8fafd`
  - `background.paper`: `#ffffff`
  - `text.primary`: `#1a202c`
  - `text.secondary`: `#4a5568`
  - Primary: trustworthy ops blue (e.g. `#1976d2`); secondary: success green (e.g. `#00c853`) for ICS theme.

- **Typography**
  - Font: `"Inter", "Roboto", "Helvetica", "Arial", sans-serif`
  - h1: 2.25rem, 700 | h2: 1.75rem, 600 | h3: 1.5rem, 600 | h6: 1.1rem, 600
  - button: `textTransform: 'none'`, fontWeight 600

- **Shape**
  - `borderRadius: 12` (global)

- **Components**
  - **MuiButton**: borderRadius 10, textTransform none, fontWeight 600, boxShadow none; hover: `0 4px 12px rgba(0,0,0,0.1)`.
  - **MuiCard**: borderRadius 16, boxShadow `0 4px 20px rgba(0,0,0,0.06)`.
  - **MuiChip**: fontWeight 600, borderRadius 8.
  - **MuiTableCell**: padding 12px 16px; head: fontWeight 700, backgroundColor alpha(primary, 0.05).
  - **MuiStepper**: padding 24px 0.

---

## 2. Sidebar (CompactSidebar inside Drawer)

- **Layout**
  - Drawer: permanent, width **260px** (open) / **72px** (collapsed); smooth transition (e.g. 0.3s).
  - Content: vertical stack — brand row → divider → list (New Ticket + nav + Admin) → divider → user block.

- **Brand row**
  - Left: logo + app name (“ICS Ticketing System”).
  - Right: collapse icon (ChevronLeft when open, ChevronRight when collapsed). Click toggles open/collapsed.

- **New Ticket**
  - Single prominent button: primary background, white text, rounded (e.g. borderRadius 3 or 8).
  - Full width within sidebar padding; icon + “New Ticket” when open; icon-only when collapsed.
  - Placed at top of list, above regular nav items.

- **Nav items**
  - One row per item: icon (fixed width) + label when open.
  - Rounded list items (e.g. borderRadius 3 or 8), slight horizontal margin (e.g. mx: 1).
  - Selected state: subtle primary tint background.
  - Items: Daily Operations, Tickets, Sites, Shipping, Inventory, Companies, Tasks, Audit, Users, Field Tech Map, SLA Management (or as per product).

- **Admin / Dispatch (role-based)**
  - Shown only for admin/dispatcher.
  - Collapsible section: “Admin” or “Admin / Dispatch” with ExpandLess/ExpandMore.
  - Nested items (e.g. Dispatcher Queue, Reports, Settings) with left indent (e.g. pl: 4).

- **User block (bottom)**
  - Divider above; compact row: avatar + name (and role) when open; avatar-only when collapsed.

---

## 3. Main content area

- **App bar**
  - Top bar: menu (mobile), breadcrumbs or title, actions (theme, notifications, user menu).
  - Consistent with theme (primary/secondary, no hardcoded blues outside palette).

- **Page content**
  - Background: `background.default` (#f8fafd in light).
  - Cards/papers: borderRadius 16, shadow per MuiCard.
  - Tables: header uses theme primary tint; cells padding 12px 16px.

---

## 4. Ticket creation (stepper)

- **Flow**
  - Steps: Basic Info → NRO Phase 1 / Type & Schedule → Scheduling & Assignment → Notes & Review.
  - One step visible at a time; Stepper at top with labels; Back / Continue (or “Create Ticket” on last step).

- **Style**
  - Paper/Card container, maxWidth ~920px, centered, generous padding (e.g. p: 4).
  - Stepper: alternativeLabel, spacing; step labels from theme typography.
  - Buttons: primary for “Continue” / “Create Ticket”, outlined for “Back”.

---

## 5. Consistency checklist

- [x] All backgrounds use theme `background.default` or `background.paper` (main content uses `background.default`; theme light default `#f8fafd`).
- [x] All primary accents use theme primary (table head, list selected/hover, buttons) so color theme switch updates everything.
- [x] Buttons: no default boxShadow; hover shadow per theme; borderRadius 10; fontWeight 600.
- [x] Chips: borderRadius 8; fontWeight 600.
- [x] Sidebar: 260/72 width, transition 0.2s; New Ticket prominent (mx 1, mb 1, borderRadius 3, hover shadow); list items rounded (borderRadius 3, mx 1); Admin collapse with pl 4; user block at bottom.

## 6. Current implementation (reference)

- **Theme**: `createAppTheme` in `App.js` — light `#f8fafd` / `#1a202c` / `#4a5568`; MuiButton/Card/Chip/TableCell/Stepper overrides; primary tints for table/list.
- **Sidebar**: `CompactSidebar.js` — Logo + “ICS Ticketing System”, New Ticket button, main nav, Admin/Dispatcher collapse, user block; used inside App Drawer (260/72px).
- **Stepper**: `CompactNewTicketStepper.js` — Paper maxWidth 920, p 4, Stepper alternativeLabel, Back / Continue / Create Ticket.
- **Doc**: This file (`frontend/src/WIREFRAMES_AND_STYLES.md`) is the single reference for wireframes and styles.
