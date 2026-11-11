# iMake UI patterns

Taken from the modules that shipped before work orders, FIFO ledgers, replenishment, and the Sri Lanka statutory screens. New screens reuse these. Do not restyle the older pages to match a new look.

Page title and icon are set with `AppLayout`. The shell renders them in the top bar (`PersistentLayout`): 1.25rem, weight 600, 24px accent icon. Pages do not draw a second title unless they are a document (create or view) with a back button.

## Filter bar

Two layouts, now `FilterBar`.

**Card** (`client/src/pages/warehouse/StockMovements.jsx`). White panel, 1px border, 12px radius, 1.5rem padding, 1.5rem below, flex wrap, 2rem gap. Each filter is a column (`FormField`, document variant):

- Label: 0.75rem, weight 700, uppercase, `var(--text-muted)`, optional 14px icon, 0.5rem under the label.
- Control height 42px, horizontal padding 0.85rem, 8px radius, 1px `var(--border-color)`, white background, 0.9rem text.
- Dates use `DatePicker` at height 42px. Parties, products, and warehouses use the existing search dropdowns.

**Inline** (`ProfitAndLoss.jsx`, `VATReport.jsx`). A row with `space-between`, wrap, 1rem gap, and a bottom border. Left side is the range (`Calendar` icon, “Date Range:”, 36px date inputs, the word “to”). Right side is a white bordered button such as Print.

List search is not a separate bar. `DataTable` draws it: search input max-width 320px, height 38px, icon at 10px, 8px radius, and the primary action on the right.

## Forms and modals

**Document form** (`NewGRN.jsx`, `NewStockReceipt.jsx`). `PageHeader`: back button (white, 8px radius, arrow), title 1.5rem weight 800, subtitle 0.75rem muted. Actions on the right: Discard (white, `#64748b`, `#e2e8f0` border) and the gradient submit (`ActionButton` variant `submit`). Fields sit in a wrapping row with 2rem gap. Line items are a spreadsheet table (`spreadsheet-cell` / `spreadsheet-input`) with a “Document Totals” footer.

**Modal form** (`PaymentTerms.jsx`), now `FormModal` on top of `Modal`. Header is the shared modal (16px radius, blur overlay, icon tile, round close). Body padding 1.75rem, fields stacked with 1.25rem gap. Modal labels (`FormField` variant `modal`) are 0.82rem, weight 600, sentence case, `var(--text-main)`, with a red `*` when required. Inputs use 0.7rem 0.85rem padding. Footer has a top border, Cancel (`#f8fafc`) then the gradient button, right aligned.

**Validation.** Add `field-invalid` on the control and render `field-error-text` under it (0.75rem, weight 600, `var(--error)`). Also raise the existing toast. Required misses and server `fields` both use that pair.

## Buttons

Primary list action: gradient `var(--accent)` to `var(--accent-secondary)`, no border, 8px radius, 0.55rem 1.25rem, 0.85rem, weight 600, white, 7px icon gap, opacity 0.88 on hover. Secondary and print: white, 1px border, same radius and type size, weight 600. Destructive confirm stays `ConfirmModal`. Row deletes are a transparent `var(--error)` icon, or the pale red Delete used on a posted document.

## Tables, badges, empty states

Prefer `DataTable` for registers: sortable headers, 15 rows, “Showing x to y of z entries”, row hover. Report sheets use a white 12px panel (`Section`) and the global table rules (uppercase 0.8rem headers, 2.25rem rows).

Status is colored uppercase text, not a pill (`Orders.jsx`): pending `#d97706`, confirmed `#0369a1`, processing `#7c3aed`, delivered or closed `#059669`, cancelled `#dc2626`. `StatusBadge` keeps that scale.

Empty copy sits in the table: 3rem padding, centered, `var(--text-muted)`. `DataTable` uses `noDataMessage`. Loading the first time uses `PageSkeleton`.

## Summary tiles

Profit & Loss and VAT: 12px white card, 1.25rem 1.5rem padding, uppercase 0.75rem label, 1.75rem weight 800 value, 42px tinted icon. `SummaryCard`.

## Responsiveness

The shell content padding is 2rem. Bars and document fields use `flex-wrap` and explicit widths (about 180–350px) so they stack. Summary rows use `repeat(auto-fit, minmax(180px, 1fr))`. Tables sit in `overflow: auto`. Do not introduce a second breakpoint system.
