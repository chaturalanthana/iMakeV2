# iMake - Available System Features

This document provides a comprehensive directory of all modules, interfaces, and backend capabilities currently active in **iMake**. 

---

## 🏗️ Core Architecture & Foundation

- **Multi-Tenant Security (Zero-Trust):** Utilizes a **Single Database, Shared Schema** architecture. Isolation is strictly enforced at both the database schema layer and backend controller level using a JWT-injected `tenantId`.
- **Stateless Authentication & Authorization:** Secure user login utilizing JSON Web Tokens (JWT) mapped to granular role permissions.
- **Dynamic 2-Step Onboarding Wizard:** Enables new tenants to register, define base localized options (e.g., base currency), and bootstrap their system configuration.
- **Theme & Design System:** A responsive glassmorphic design system using CSS variables, offering a modern dark slate primary sidebar, standard transactional layouts, printing formats (clean high-contrast black and white), and interactive modal dialogs.

---

## 📊 1. Dashboard Module
- **Operational Metrics:** Real-time visibility into key financial figures, stock levels, pending sales/purchases, and outstanding balances.
- **Central Action Center:** Direct access to core shortcuts and status notifications for onboarding tasks.

---

## 🏭 2. Production & Manufacturing Module
- **Products Register:** Comprehensive product management including pricing, cost tracking, SKU code definitions, category/brand assignments, costing methods (FIFO, LIFO, etc.), and UOM definitions.
- **Bill of Materials (BOM):** Multi-level structure listing raw materials, component quantities, scrap percentages, and workstation requirements to manufacture finished goods.
- **Production Calendar:** Interactive schedule for organizing production runs, shifts, and tracking order timelines.
- **Planning Board:** Drag-and-drop / Kanban-style interface for workstation dispatching, resource allocation, and job sequencing.
- **Production Orders:** Creation, scheduling, and execution tracking of work orders from draft to completed manufacturing status.
- **Workstations Manager:** Database of physical production lines, machinery, hourly rates, capacities, and scheduling calendars.
- **Material Requirements Planning (MRP) Planner:** Automated stock requirement calculators matching production demand with inventory availability to generate suggested purchase or transfer orders.
- **Product Groups & Registries:** Segment products dynamically by Brands, Categories, Types, and custom Unit of Measure (UOM) conversions.

---

## 🛒 3. Sales Module
- **Customer Directory:** Profiles of B2B/B2C accounts containing credit limits, tax settings, address details, and default payment terms.
- **Customer Categories:** Custom groups to segment customers for pricing structures and GL mappings.
- **Price Lists:** Multi-tier currency-specific pricing matrices for dynamic price applications based on customer classifications.
- **Discount Groups:** Custom promotional rule configurations that automatically apply item-level discounts.
- **Sales Quotations:** Standardized sales proposals (Draft -> Sent -> Approved) with automated tax and subtotal calculations.
- **Sales Orders:** Confirmed client orders tracking execution, outstanding balances, and delivery progress.
- **Sales Deliveries:** Delivery notes dispatching inventory from specified warehouses, automatically reducing physical stock ledger balances.
- **Sales Invoices:** Commercial invoices mapping to outstanding deliverables with dynamic payment status updates (`UNPAID`, `PARTIALLY PAID`, `PAID`).
- **Customer Outstanding Report:** A real-time AR aging sub-ledger reflecting outstanding client debts.

---

## 🛍️ 4. Procurement (Purchases) Module
- **Supplier Registry:** Profiles for vendors outlining lead times, base currencies, accounts payable codes, and payment histories.
- **Payment Terms Registry:** Configuration tables for vendor terms (e.g., Net 30, COD).
- **Tax & Withholding Groups:** Specific rules mapping incoming VAT and Withholding Tax configurations directly to financial charts.
- **Purchase Requisitions:** Internal request workflows allowing staff to request purchases for department needs.
- **Purchase Orders (PO):** Formalized buying requests mapping requisitions to chosen suppliers, complete with conversion rates.
- **Goods Receipt Notes (GRN):** Logs for receiving inventory at the warehouse, referencing purchase orders to track quantity discrepancies.
- **Supplier Outstanding Report:** AP aging ledger detailing liabilities owed to each vendor.

---

## 📦 5. Stock & Warehouse Module
- **Warehouses Directory:** Multi-warehouse facility support mapping physical items to specific locations.
- **Stock Receipts & Issues:** Log points for manual inventory adjustments, goods arrivals, or materials utilization.
- **Stock Transfers:** Relocate inventory items across warehouses with system audit trails tracking stock-in-transit.
- **Stock Adjustments:** Tool for physical stock takes, auto-calculating variances between physical counts and system balances.
- **Stock Ledger (Movements):** Chronological ledger tracking every inventory transaction (Receipt, Issue, Transfer, Sale, Purchase) to calculate running FIFO/LIFO valuations.
- **Inventory Report:** Tabulated overview of current stock levels, safety parameters, unit costs, and overall asset values.

---

## 💼 6. Financial Accounting Module
- **Chart of Accounts (COA):** Hierarchical ledger management tracking assets, liabilities, equity, revenues, and expenses with unlimited nested sub-accounts.
- **General Ledger:** The absolute double-entry record auditing all journal lines, credits, and debits.
- **Journal Entries:** Manual voucher entries to record adjustments, accruals, and internal account allocations.
- **Payment Receipts (Accounts Receivable):** Log incoming payments (Cash, Cheque, Bank Transfer) and link them to outstanding customer invoices.
- **Payment Vouchers (Accounts Payable):** Record cash or bank disbursements to settle outstanding supplier invoices.
- **Multi-Currency System:** Live base and foreign exchange rate conversions dynamically calculating transaction equivalents.
- **Tax Groups & VAT Report:** Local tax calculation mappings with dynamic summaries of input and output VAT liabilities.
- **Bank Reconciliation Engine:** Interface to upload bank statements, auto-match statement lines against ledger entries, and post adjustments.
- **Financial Statements:**
  - **Profit & Loss (P&L):** Income statement tracking revenues, COGS, operational expenses, and net profit.
  - **Balance Sheet:** Point-in-time financial statement showing Assets, Liabilities, and Equity balances.
  - **Cash Flow Statement:** Dynamic statement summarizing cash inflows and outflows categorized by Operating, Investing, and Financing activities.
  - **Cash Book & Bank Book:** Focused sub-ledgers tracking real-time liquid asset accounts.

---

## 👥 7. Human Resources (HR) & Payroll Module
- **Employee Directory:** Biographical, payroll, department, and structural hierarchy data for active staff members.
- **Additions Master & Deductions Registry:** Configuration maps for recurring or one-time bonuses, commissions, statutory taxes, and voluntary deductions.
- **Leave Management:** Application portal, approval status tracking, and annual leave balance counters.
- **Loan Management:** System tracking employee salary advances, amortization schedules, and automatic monthly payslip deductions.
- **Holiday Calendar:** Central repository for tracking national holidays and non-working business periods.
- **Salary Processing (Payroll Run):** Dynamic engine compiling working hours, leaves, additions, deductions, and loan repayments to generate monthly payroll.
- **Payslips Generator:** Automated PDF/printable pay slips matching finalized payroll runs.

---

## ⚙️ 8. System Settings
- **Users Management:** Multi-tenant user registries enabling invites, active/inactive toggles, and direct email mapping.
- **RBAC Roles & Permissions:** Fine-grained Role-Based Access Control allowing administrators to modify JSON permission trees for any view or operational controller.
