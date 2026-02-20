# Wireframes & Styles Reference (UI Polish Package)

Target layout, theme, and component styles from the Complete UI Polish Package.

## 1. Global theme
- **Light**: background default `#f8fafd`, paper `#ffffff`; text primary `#1a202c`, secondary `#4a5568`.
- **Typography**: Inter; button textTransform none, fontWeight 600; headings per spec.
- **Shape**: borderRadius 12.
- **MuiButton**: borderRadius 10, fontWeight 600, boxShadow none; hover `0 4px 12px rgba(0,0,0,0.1)`.
- **MuiCard**: borderRadius 16, boxShadow `0 4px 20px rgba(0,0,0,0.06)`.
- **MuiChip**: fontWeight 600, borderRadius 8.
- **MuiTableCell**: padding 12px 16px; head fontWeight 700, backgroundColor alpha(primary, 0.05).
- **MuiStepper**: padding 24px 0.

## 2. Sidebar
- Drawer width 260 (open) / 72 (collapsed), transition 0.3s.
- Brand row: logo + "ICS Ticketing System" + collapse icon.
- **New Ticket**: prominent primary button, rounded (borderRadius 3 or 8), icon + label when open.
- Nav items: rounded (mx 1, borderRadius 3), icon + label; selected = primary tint.
- Admin section (role-based): collapsible; nested items pl 4.
- User block at bottom: avatar + name/role when open.

## 3. Main content
- Page background = theme background.default.
- Cards/tables use theme; no hardcoded primary.

## 4. Ticket stepper
- Steps: Basic Info → Type & Schedule → Assignment → Notes & Review.
- Paper maxWidth ~920, Stepper alternativeLabel; Back / Continue; Create on last step.
