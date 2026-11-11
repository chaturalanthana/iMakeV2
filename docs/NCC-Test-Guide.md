# iMake test guide

Nawaloka Consumer Care · iMake OS SRS v2.0

This guide is for Chatura and the client testers. The demo company is **Ceylon Woodworks (Pvt) Ltd**. Use it to click through each flow and mark Pass or Fail.

The home screen tiles, the chart, and the audit list are live figures for this company. Payroll is hidden until you turn it on.

## 1. Start the app and sign in

**Purpose.** Open a fresh copy and sign in with the two demo users.

**SRS.** NFR-02

1. Install Node.js 22 and PostgreSQL 16. Copy `.env.example` to `.env` and `server/.env.example` to `server/.env`. Put the same database password in `POSTGRES_PASSWORD`, `DATABASE_URL` (root file and `server/.env`), and set `JWT_SECRET`.
2. Start the database. From the project folder run `npm ci`, `npm ci --prefix server`, `npm ci --prefix client`, then `npm --prefix server run db:migrate` and `npm --prefix server exec -- prisma generate`.
3. Load the demo: `npm run seed:demo`.
4. Start the app: `npm run dev`. Open `http://localhost:3000`.
5. Sign in. The email addresses and the shared password are the constants `EMAIL`, `APPROVER_EMAIL`, and `PASSWORD` at the top of `server/scripts/seedDemo.js`. Do not copy the password into chat or email.
   - **Nimal Perera** enters documents. He cannot approve his own work.
   - **Kamani Dias** is the approver (Finance).

**Expected.** Both users reach the home screen. The company name is Ceylon Woodworks (Pvt) Ltd. Revenue, orders, jobs, and shortages match the registers, not a fixed sample. The left menu has no Human resources section.

- [ ] Pass
- [ ] Fail

![Sign-in screen](test-guide/img/login.png)

![Home screen](test-guide/img/dashboard.png)

## 2. Master data

**Purpose.** Check items, customers, suppliers, and the stores.

**SRS.** MM-01, MM-02, MM-03, SCP-02, SCP-03

1. Sign in as Nimal.
2. Open **Production → Products**. You should see teak, screws, varnish, fabric, glue, the dining chair, and the side table.
3. Open **Sales → Customers**. Galle Heritage Hotel has a large credit limit. Kandy Cafe Co has a small one. Factory cash counter is cash only.
4. Open **Purchases → Suppliers**. Kelani Timber, Colombo Hardware, and Elakanda Contract Packers are there.
5. Open **Stock → Warehouses**. MAIN is the raw store, FG-01 is finished goods, SUB-01 is the contract floor, VAN-01 is the van.

**Expected.** Codes are unique. The chair and the table have a bill of materials. Kilogram is available as a unit.

- [ ] Pass
- [ ] Fail

![Products](test-guide/img/products.png)

![Customers](test-guide/img/customers.png)

## 3. Purchase: requisition to payment

**Purpose.** Follow a buy from request to payment, including a second person approving it.

**SRS.** PR-01, PR-02, PR-04, PR-06, WF-01, WF-02, INV-03

1. As Nimal, open **Purchases → Purchase Requisitions**. One requisition is already waiting: extra teak for LKR 9,000.
2. Sign out. Sign in as Kamani. Open **Approvals**. Approve that requisition. A reason is required only when you return or reject.
3. Sign back in as Nimal. Open **Purchases → RFQs**. The teak request already has two quotes. Kelani Timber was selected because the price and lead time were better.
4. Open **Purchase Orders**, **GRNs**, **Landed Cost**, and **Supplier Invoices**. The varnish receipt is already there, with freight added and the supplier invoice matched.
5. To try a new one: **Purchase Requisitions → New**, add a line, save. It stays pending until Kamani approves it. Then raise the purchase order, receive it on a GRN with a lot and a bin, add landed cost, and match the supplier invoice.
6. Pay it from **Finance → Payment Vouchers**. Kamani must approve the payment before it posts.

**Expected.** Nimal cannot approve his own requisition. After approval the document can move on. The goods receipt increases stock. Freight is added to the item cost. The supplier invoice clears the goods-received-not-invoiced balance.

- [ ] Pass
- [ ] Fail

![Approvals](test-guide/img/approvals.png)

![Goods receipts](test-guide/img/grns.png)

## 4. Quote to cash

**Purpose.** Sell a chair: quote, order, delivery, invoice, and money in.

**SRS.** SL-01, SL-02, SL-05, FN-03

1. Open **Sales → Quotations**. One quote for Galle Heritage Hotel is already approved.
2. Open **Orders**. The hotel chair order is delivered. The side-table order is still open (that one is made to order).
3. Open **Deliveries** and **Invoices**. The hotel invoice is still unpaid, apart from a small credit note.
4. Open the hotel invoice and use **Receive payment**, or open **Finance → Payment Receipts → New** and allocate the invoice.
5. To test credit hold: as Nimal, create an order for **Kandy Cafe Co** for two dining chairs. The cafe limit is LKR 20,000, so the order waits for approval.
6. Sign in as Kamani, open **Approvals**, and approve the credit release. The order can then be delivered.

**Expected.** An order over the credit limit is not released until Kamani approves it. Delivery reduces finished-goods stock. The invoice shows on customer outstanding until the receipt is allocated.

- [ ] Pass
- [ ] Fail

![Sales orders](test-guide/img/orders.png)

![Sales invoices](test-guide/img/invoices.png)

## 5. Dispatch: price, pick, pack, gate pass, trip, and proof

**Purpose.** Move a general-trade order from release to the truck and back.

**SRS.** SL-01, SL-02, SL-03, SL-05

1. Open **Sales → Customer prices**. Galle Heritage Hotel has a chair price. A group price and a modern-trade price are there too.
2. Open **Sales → Dispatch**. Order **SO/DEMO/00001** is pending for two chairs at Elakanda. Press **Release** and choose **Elakanda distribution**.
3. Open **Route picks**. Press **New pick list**. Choose Elakanda, route **General trade north**, vehicle **WP-LD-2041**, and that order. Create it.
4. On the new row press **Pick**, then **Pack**, then **Delivery**.
5. Open **Trips**. Press **New trip**. Tick the new delivery, set the driver to Ranjith, and choose the same vehicle. Create it.
6. On the trip press **Invoice**, then **Gate pass**. The gate pass waits for Kamani because approvals are on.
7. Sign in as Kamani, open **Approvals**, and approve the gate pass. Sign back in as Nimal.
8. Open the trip and press **Depart**, then **POD**. Enter who received the goods. Leave rejected quantity at 0 for a clean delivery. If some goods come back, enter the quantity and a reason, then open **Sales returns** if finance needs the credit note.
9. A finished example is already on the list: trip **TS/2026/11/00001**, gate pass issued, status departed.

**Expected.** The vehicle cannot depart until the invoice and an issued gate pass exist. Stock falls when the delivery note is posted. The proof records who signed.

- [ ] Pass
- [ ] Fail

![Dispatch board](test-guide/img/dispatch.png)

![Trips and gate passes](test-guide/img/trips.png)

## 6. Van and factory cash sale

**Purpose.** Sell from the van or the factory counter in one step.

**SRS.** SL-04

1. Open **Sales → Van / factory sales**.
2. Choose **Van sales** or **Factory cash**.
3. Customer: Galle Heritage Hotel. Location: **Van 01 stock** or **Factory cash counter**. Product: dining chair or side table. Enter the quantity. The price fills from the price list.
4. Press **Post sale**.
5. If approvals are on, the sale waits for Kamani. After approval, stock in that location falls and the invoice is paid in cash.

**Expected.** One action posts the invoice, the stock issue, revenue, and the cash receipt together. You do not create a separate receipt.

- [ ] Pass
- [ ] Fail

![Van and factory sales](test-guide/img/cash-sales.png)

## 7. Returns both ways

**Purpose.** Take a customer return and send goods back to a supplier.

**SRS.** INV-09, SL-05

1. Open **Stock → Returns**.
2. One line is a customer return (goods return advice) for a chair that was not accepted. It sits in quarantine and is not available to sell.
3. The other line is a supplier return for a leaking tin of varnish. That quantity has left the store.
4. To add one: **New**, choose Market, Damage, GRA, or Supplier, enter the item, quantity, and a reason, then post.

**Expected.** A customer return does not go back into free stock. A supplier return reduces on-hand stock.

- [ ] Pass
- [ ] Fail

![Returns](test-guide/img/returns.png)

## 8. Material request, issue, and transfer

**Purpose.** Ask for stock, pick it, issue it, and move some to another store.

**SRS.** INV-04, INV-05, INV-08

1. Open **Stock → Material Requests**. The assembly request for screws is already fulfilled. Open it to see the pick list.
2. Open **Goods Transfers**. One tin of varnish is in transit from MAIN to FG-01. Open it and press **Receive**.
3. To try a new request: **Material Requests → New**, choose Issue, the assembly team, MAIN, and a small quantity of screws. Approve it, build the pick list, then fulfil it.

**Expected.** You cannot fulfil more than the request. An in-transit transfer is not available at the destination until it is received. The pick list suggests the oldest lot.

- [ ] Pass
- [ ] Fail

![Material requests](test-guide/img/material-requests.png)

![Transfers](test-guide/img/transfers.png)

## 9. Cycle count

**Purpose.** Count the shelf and post the difference only after approval.

**SRS.** INV-11

1. Open **Stock → Cycle Counts**. The screw count is already posted (two boxes short).
2. Start a new count: **New**, warehouse MAIN, enter a physical quantity that differs from the book, and a reason.
3. With approvals on, the difference waits for Kamani. After approval, post it.
4. Open **Stock → Stock Reports**, choose **Count variance**, and export the sheet.

**Expected.** The book quantity and the counted quantity are both stored. Stock and the ledger change only after the count is approved and posted.

- [ ] Pass
- [ ] Fail

![Cycle counts](test-guide/img/cycle-counts.png)

## 10. Weekly plan and a work order

**Purpose.** Plan the week, release a work order, confirm the shop floor, and close it.

**SRS.** PD-01, PD-02, PD-04, PD-05, PD-06

1. Open **Production → MRP Planner**. Press **Run**, then open the **MPS** tab. Firm a planned chair order if you want a new work order.
2. Open **Work Orders**. One chair batch is created and waiting. The side table is a draft from the sales order.
3. Open the chair batch and press **Release**.
4. Press **Shop floor**. Confirm each step (cut, assemble, finish) with the good quantity.
5. When the full quantity is confirmed, use **Close now**. If you made fewer than ordered, use **Short close**.
6. Open **Production → Production Reports** and look at the variance.

**Expected.** Release warns if material is short but still releases. Confirming the last step receives the finished chairs. Close now is refused until the full quantity is received.

- [ ] Pass
- [ ] Fail

![MRP planner](test-guide/img/mrp.png)

![Work orders](test-guide/img/work-orders.png)

## 11. Make-to-order sales order

**Purpose.** A side table is not kept in stock. The sales order should raise a draft work order.

**SRS.** PD-02, SL-01

1. Open **Sales → Orders** and open the side-table order for Galle Heritage Hotel.
2. Open **Production → Work Orders**. A draft work order for that table is linked to the order.
3. To try another: create a sales order for one side table. A new draft work order appears.

**Expected.** The dining chair (make to stock) does not get a work order from the sales order. The side table does.

- [ ] Pass
- [ ] Fail

![Shop floor](test-guide/img/shop-floor.png)

## 12. Contract manufacturing

**Purpose.** Send work to Elakanda and receive it back at the virtual floor.

**SRS.** SCP-03, INV-03, PD-01

1. Open **Production → Contract Manufacturing**.
2. The draft order is for two dining chairs at SUB-01, finished goods back to FG-01, with a service charge.
3. Open it and issue teak from MAIN, receive the chairs, then post the service charge.

**Expected.** SUB-01 is a virtual warehouse tied to Elakanda Contract Packers. Issued material leaves MAIN. Received chairs land in finished goods.

- [ ] Pass
- [ ] Fail

![Contract manufacturing](test-guide/img/contracts.png)

## 13. Abnormal loss

**Purpose.** Scrap above the allowed percent waits for finance, then posts to the loss account.

**SRS.** PD-07

1. Open **Production → Abnormal losses**. One row is already pending: a power cut on the furniture line.
2. Sign in as Kamani. Open **Approvals**. Approve **Abnormal production loss**.
3. Sign back in as Nimal. The loss list now says posted. The trial balance shows the abnormal loss account.
4. On a new work order, confirm the last step with scrap above 2 percent and a scrap reason. A new row appears in Approvals for Kamani. It does not post until she approves it.

**Expected.** Nimal cannot post his own loss. Approval debits the abnormal loss account and credits work in progress.

- [ ] Pass
- [ ] Fail

![Abnormal losses](test-guide/img/losses.png)

## 14. Capex, CWIP, asset, and depreciation

**Purpose.** A packing line is bought as capital, held as work in progress, then turned into an asset and depreciated.

**SRS.** PR-03, PR-06, FN-06

1. Open **Finance → Capital Projects**. PACK-1 is the packing line, budget LKR 2,500,000.
2. Open **Finance → Fixed Assets**. CWIP-PACK is already an active asset (capitalized from the deposit).
3. The November depreciation run has been posted. Accumulated depreciation shows on the trial balance.
4. To try a new one: **Purchases → Capex Request**, choose project PACK-1, and save. Kamani approves capital requests. After the goods receipt, capitalize the asset from the asset screen and run depreciation for an open month.

**Expected.** The capitalization threshold in finance settings is LKR 100,000. Capital spend needs a project. Depreciation uses exact days in the month.

- [ ] Pass
- [ ] Fail

![Fixed assets](test-guide/img/assets.png)

## 15. Credit notes, debit notes, IOU, and the bank

**Purpose.** Adjust an invoice, track an employee advance, and match the bank.

**SRS.** FN-03, FN-04, FN-05

1. Open **Finance → Credit and Debit Notes**. A customer credit note for LKR 1,000 is posted against the hotel (reason RETURN).
2. Open **Cheques**. Cheque CHQ-4401 is unrealised (money not in the bank yet).
3. Open **IOU and Petty Cash**. The Malabe tin was funded, and Kumari Silva has an open advance. Open it and settle part of it to an expense account.
4. Open **Bank Reconciliation**. A draft November statement is there, including the packing-line payment. Match the line to the ledger, or import a CSV, then finalize.
5. A supplier withholding-tax certificate is available from a posted payment voucher when WHT applies. WHT is calculated at payment. SVAT is off.

**Expected.** A credit note reduces what the customer owes. An IOU stays open until it is settled. An unrealised cheque is not the same as cash in the bank.

- [ ] Pass
- [ ] Fail

![Credit and debit notes](test-guide/img/notes.png)

![IOU and petty cash](test-guide/img/ious.png)

## 16. Month-end and a locked period

**Purpose.** Close the books in order, then prove a closed month cannot be posted to.

**SRS.** FN-01, FN-02, WF-04

1. Open **Settings → Fiscal periods**. Year 2026. **Allow negative stock** is off. October 2026 is Closed. November 2026 is Open.
2. Open **Finance → Journal Entries → New**. Date it 15 October 2026 and try to post a balanced entry. The system refuses it.
3. Open **Finance → Period Close**. Open November if it is not listed. Tick the steps in order: Inventory, Production, Accounts payable, Accounts receivable, Cash and bank, Fixed assets, then General ledger.
4. Post the closing entries only after those steps are done. The month then rejects every new posting.
5. Try to issue stock that would go below zero. With the box unticked, the system blocks it.
6. **Show payroll menu** is off. The left menu has no Human resources group. Tick the box and the page reloads with Employees, salary, and payslips. Tick it off again before you finish. Payroll is not part of the signed NCC scope.

**Expected.** October rejects the journal even though journals need approval. November still accepts a balanced journal, which then waits for Kamani.

- [ ] Pass
- [ ] Fail

![Fiscal periods](test-guide/img/periods.png)

![Period close](test-guide/img/period-close.png)

## 17. Audit history

**Purpose.** See who did what.

**SRS.** WF-04, NFR-02

1. Open **Settings → Audit log**.
2. Filter by entity or date. Opening stock, the credit note, the approvals, and the period change are listed.
3. Export the sheet if you need to send it.

**Expected.** Each row shows the action, the document, the person, and the time. Posted documents are corrected by reversal, return, or credit note, not by deleting the history.

- [ ] Pass
- [ ] Fail

![Audit log](test-guide/img/audit.png)

## 18. Reports and the trial balance

**Purpose.** Check that the books balance and that every finance and stock report exports to Excel.

**SRS.** RPT-01, RPT-02, INV-02, FN-01

1. Open **Finance → Trial Balance**. Total debit and total credit are both **350,200.50**. The green line says debits equal credits. Each account is on one side only.
2. Press **Export**. The file is an Excel sheet with one header row.
3. Open **Finance → Finance Reports**. Pick each report (profit and loss, balance sheet, ageing, GRNI, stock valuation, asset register, VAT, and the rest). Press **Export XLSX**.
4. Open **Stock → Stock Reports**. Switch among stock position, movement, ageing, and count variance. Press **Export XLSX**.
5. Open **VAT Report** and **Profit & Loss** and use their export or print buttons.

**Expected.** The trial balance stays equal after the documents in this guide. Excel files open in a spreadsheet. Print uses the browser print dialog.

- [ ] Pass
- [ ] Fail

![Trial balance](test-guide/img/trial-balance.png)

![Finance reports](test-guide/img/finance-reports.png)

## Defaults chosen where the SRS said “confirm”

| Topic | Demo choice |
| --- | --- |
| Currency | LKR for the books. USD is loaded at 305. No other currencies. |
| Tax | VAT and WHT groups exist. WHT is taken at payment. SVAT is off. |
| Capital threshold | LKR 100,000. A capital request needs project PACK-1. |
| Price tolerance | 2 percent against a contract price. |
| Approvals | On for requisitions, capital requests, purchase orders, supplier payments, journals, credit and debit notes, stock adjustments, cycle counts, material requests, price overrides, and credit release. The maker cannot approve their own document. |
| Approval amounts | Purchase orders: LKR 50,000 then 250,000. Supplier payments: LKR 10,000 then 100,000. Other controlled documents: any amount. |
| Stock | Negative stock is blocked. Valuation is FIFO and cannot be switched. |
| Credit | Over-limit or overdue orders wait for Kamani. |
| Periods | October 2026 is closed. November 2026 is open. |
| Yield and scrap | Furniture 98 / 2. Soya 97 / 2. Pasta 96 / 3. Sauce 98 / 1.5. Abnormal loss starts at 2 percent. |
| Planning | Eight-week horizon. Labour LKR 650 an hour. Overhead 10 percent of conversion. Close grace is 3 days. |
| Stores | MAIN raw store, FG-01 finished goods, ELK Elakanda distribution, VAN-01 van, FAC-CASH factory counter, SUB-01 contract floor. Route GT-NORTH. Bins: BIN-A1, QA-HOLD, DMG-01. |
| Cost centres | Soya, Pasta, Sauce, Turkey Import, Contract Manufacturing, and Administration. Administration is split 20 percent to each operation. |

## Known limitations

- The iForce SFA link was dropped. Orders are typed into iMake. Nothing is sent to a field-sales system.
- Payroll screens stay in the product but stay hidden until **Settings → Fiscal periods → Show payroll menu** is ticked. They are outside the signed NCC scope.
- Excel export covers the finance report catalogue, the trial balance, the audit log, and the stock reports. Batch trace is print only.
- A rejected proof of delivery records the quantity. Finance still posts the credit from **Sales returns** or **Credit and debit notes** when the invoice must change.
