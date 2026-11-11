# iMake - Development Guide

Welcome to the internal development guide for **iMake**, a production-ready, multi-tenant ERP system built on the PERN stack. This document serves to record all structural decisions, best practices, and module developments.

---

## 🏗️ Technology Stack
*   **Database:** PostgreSQL (v16) accessed via Prisma ORM (v6).
*   **Backend:** Node.js backend using Express.js.
*   **Frontend:** React.js powered by Vite (Port 3000).
*   **Styling:** Vanilla CSS leveraging CSS Variables for centralized theming (Light Theme / Glassmorphism).
*   **Authentication:** Stateless JWT. `JWT_SECRET` comes from the environment.

---

## 🔐 Multi-Tenant Architecture (Zero-Trust)
The system utilizes a **Single Database, Shared Schema** approach for multi-tenancy. 

1. **Foreign Keys:** Every core database model (e.g., `User`, `Customer`, `Product`) contains a mandatory `tenantId` field referencing the central `Tenant` table.
2. **Authentication Flow:** When a user registers or logs in, the `/api/auth` endpoint resolves their email to their specific `tenantId` and rigidly bakes it into a cryptographic JWT token.
3. **Data Isolation (Middleware):** The Express backend enforces `src/middlewares/tenantMiddleware.js` on all protected routes. This middleware validates the JWT and injects `req.tenantId`. **Controllers must *always* use `req.tenantId` in their Prisma `where` clauses.** It is impossible for a user to query data outside of their tenant scope.

---

## 📂 Frontend Directory Structure (`/client`)
Built to strict UI/UX consistency standards.

*   **`src/components/layout/AppLayout.jsx`**: A Higher-Order Component wrapping all authenticated routes. It guarantees the Side Panel and Top Header remain consistent across the app.
*   **`src/components/layout/Sidebar.jsx`**: Holds the primary navigation logic for all ERP modules (`Sales`, `Inventory`, `Finance`, etc.).
*   **`src/pages/`**: Contains top-level route views (e.g., `Onboarding.jsx`, `Login.jsx`, `Dashboard.jsx`).
*   **`src/index.css`**: The design system's source of truth. Contains custom CSS Root Variables for the Light Theme, layout utilities (`.glass-panel`, `.input-field`), and reusable keyframe animations (`slideUp`, `float`).
*   **`src/App.jsx`**: Controls `react-router-dom` guarding authenticated routes checking for `localStorage.getItem('token')`.

---

## 📂 Backend Directory Structure (`/server`)

*   **`prisma/schema.prisma`**: The declarative schema containing all tables (`Tenants`, `Users`, `JournalEntries`, `PurchaseOrders`, etc.).
*   **`src/app.js`**: The Express configuration, setting up CORS, JSON parsing, and generic error handling. Uploaded files are not public.
*   **`src/routes/`**: API endpoints. `index.js` mounts each module behind `secureModule`, which checks the signed-in user's role.
*   **`src/permissions/catalog.js`**: Module list and the roles seeded for a new tenant.
*   **`src/validation/`**: Zod request checks for masters, purchasing, inventory, and sales. Failures return `{ error, fields }`.
*   **`src/controllers/`**: Executes business logic and database mutations. Stock posting runs inside a Prisma transaction.
*   **`src/middlewares/`**: Contains security walls (`authMiddleware.js`, `tenantMiddleware.js`, `rbacMiddleware.js`).
*   **`src/lib/prisma.js`**: Reusable singleton for the connected Prisma Client.

---

## 🚀 Running the Development Environment

Currently, the setup requires both the Backend and Frontend to run concurrently along with a resilient PostgreSQL background service.

Copy `.env.example` to `.env` and `server/.env.example` to `server/.env`, then set `POSTGRES_PASSWORD`, `DATABASE_URL`, and `JWT_SECRET`. The API refuses to start when `JWT_SECRET` or `DATABASE_URL` is missing. Do not reuse the old public password or JWT fallback; rotate them.

**1. Database Deployment**
Schema changes are applied with Prisma Migrate:
```bash
cd server
npx prisma migrate dev
```
A database that was previously created with `prisma db push` and already matches this schema can be baselined once with:
```bash
npx prisma migrate resolve --applied 20261110120000_baseline
```

**2. Start the Backend API**
```bash
cd server
npm run dev
# Starts Nodemon on http://localhost:5000
```

**3. Start the Frontend React App**
```bash
cd client
npm run dev
# Starts Vite on http://localhost:3000. Proxies unknown /api requests to port 5000 automatically.
```

**4. Start Both Concurrently (Recommended)**
To start both the client and server concurrently using a single command from the root directory:
```bash
npm run dev
```

## 📊 UI Components & Design Patterns

### Reusable Page Headers
All transactional documents (Quotations, Orders, Deliveries, Invoices) must feature a standard, structured page header layout:
1. **Vertical Divider Line:** The header wrapper must use a clean bottom divider line styling (`borderBottom: '1px solid var(--border-color)'`) with `paddingBottom: '1rem'` and `marginBottom: '0.75rem'` to separate actions and page metadata from form details.
2. **Typography Structure:** Page title and status indicators (e.g. "Saving Changes..." or last saved timestamp) must align vertically in a column using a flex wrapper with `flexDirection: 'column'` and `gap: '0.25rem'`.

### Transactional Data Tables (Spreadsheet Mode)
For all transactional documents (e.g., Quotations, Orders, Invoices, GRNs) that require row-level line item entry, the `TransactionalTable` component (`src/components/ui/TransactionalTable.jsx`) **MUST** be used.

**Rules for Transactional tables:**
1. **Spreadsheet-style Editing:** Cell-based inputs for details, unit price, quantity, and actions (e.g., Delete row).
2. **UI Locking:** The component accepts a `disabled` prop. When `disabled` is set to `true`, the UI is locked (e.g. read-only text fields, disabled dropdown pointers, and hide the add/remove rows buttons). This is the absolute standard pattern to prevent updates to completed/accepted transactions.
3. **Automatic Number Formatting:** Values like Unit Price and Totals must always format correctly using commas and decimals.
4. **Column Alignment:** Date/Details left-aligned, unit price, qty, and total right-aligned.

### Transactional View Pages (Read-Only Mode)
When viewing any completed, converted, or accepted transaction (e.g., a completed Quotation, Sales Order, Invoice), the view page **MUST** transform into a clean, black-and-white, printable document style.

**Rules for Transactional View Pages:**
1. **Plain Text Instead of Controls:** All form elements (e.g., Customer dropdown selects, Date pickers, text inputs) must render as plain text labels with simple borders/underlines, instead of interactive input fields.
2. **Black & White Report Theme:** Remove all brand/accent colors (e.g., blue amounts/totals) from data columns and values. Render them in high-contrast plain black (`#000`) text. Only main action buttons at the page header may keep their brand styling.
3. **Hide Design Elements:**
   - Remove helper section titles like "Add Products" that imply data-entry actions.
   - Hide destructive actions like the "**Delete**" button to protect completed audit history.
   - The title of the page must strictly display the **document code** (e.g. `QUO/2026/06/00001`) as the main heading, without pre-pended text (like "View Quotation").
4. **Vertical Alignment:** Ensure cell spacing and alignments (e.g. details left, quantities centered, amounts right) align perfectly with their headers.

### 🚨 Theme-Matching Alert & Confirmation UI
*   **No Browser Defaults**: Native browser dialogs (`window.alert`, `window.confirm`, `window.prompt`) are strictly forbidden because they disrupt the user experience and break styling consistency.
*   **ConfirmModal Component**: Always use the reusable `ConfirmModal` component (`src/components/ui/ConfirmModal.jsx`) for confirmations (such as deleting files, duplicating records, archiving items).
*   **UX Configurations**:
    *   Set `type="danger"` for destructive actions (e.g. deletion) to display red warnings.
    *   Set `type="primary"` for constructive actions (e.g. duplication, activation) to match the brand accents.
    *   Ensure a blurred background overlay (`backdropFilter: 'blur(8px)'`) is active to maintain premium visual focus.

---

## 📝 Development Ledger / Milestones
*   [x] **Phase 1:** Setup PostgreSQL environments & `.env` configuration.
*   [x] **Phase 2:** Define multi-tenant Prisma Schemas.
*   [x] **Phase 3:** Create JWT Zero-Trust Auth Backend Middleware.
*   [x] **Phase 4:** Create stunning split-pane UI for Auth and 2-Step Tenant Onboarding Wizard.
*   [x] **Phase 5:** Systemize Frontend UX (Sidebar, Layouts, Dashboards).
*   [x] **Phase 6:** Build initial `Contacts` (Customers/Suppliers) module.
*   [ ] **Phase 7:** Build `Inventory` management. 

*(This document should be continuously updated as new workflows or core logic are introduced to the repository).*
