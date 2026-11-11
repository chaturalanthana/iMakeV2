-- Auto-replenishment, payment WHT certificates, payroll statutory amounts, and lot labels.

ALTER TABLE "payment_vouchers" ADD COLUMN "wht_amount" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "payment_vouchers" ADD COLUMN "wht_rate" DECIMAL(9,4) NOT NULL DEFAULT 0;

ALTER TABLE "salary_run_lines" ADD COLUMN "epf_employee" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "salary_run_lines" ADD COLUMN "epf_employer" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "salary_run_lines" ADD COLUMN "etf_employer" DECIMAL(19,4) NOT NULL DEFAULT 0;

ALTER TABLE "purchase_requisitions" ADD COLUMN "source_type" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "purchase_requisitions" ADD COLUMN "source_id" TEXT;
ALTER TABLE "purchase_requisitions" ADD COLUMN "notes" TEXT;

ALTER TABLE "cost_layers" ADD COLUMN "lot_number" TEXT;

CREATE TABLE "item_warehouse_policies" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "reorder_point" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "min_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "max_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "item_warehouse_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "replenishment_runs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "run_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "trigger" TEXT NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    CONSTRAINT "replenishment_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "replenishment_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "warehouse_id" TEXT,
    "kind" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "min_max_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "mrp_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "pr_id" TEXT,
    "work_order_id" TEXT,
    CONSTRAINT "replenishment_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "operations_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "replenish_daily" BOOLEAN NOT NULL DEFAULT false,
    "last_replenish_on" TIMESTAMP(3),
    CONSTRAINT "operations_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "statutory_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "epf_employee_percent" DECIMAL(9,4) NOT NULL DEFAULT 8,
    "epf_employer_percent" DECIMAL(9,4) NOT NULL DEFAULT 12,
    "etf_employer_percent" DECIMAL(9,4) NOT NULL DEFAULT 3,
    CONSTRAINT "statutory_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wht_certificates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "certificate_number" TEXT NOT NULL,
    "voucher_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "gross_amount" DECIMAL(19,4) NOT NULL,
    "wht_rate" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "wht_amount" DECIMAL(19,4) NOT NULL,
    "payment_wht" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "invoice_wht" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "net_paid" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wht_certificates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "item_warehouse_policies_tenant_id_product_id_warehouse_id_key" ON "item_warehouse_policies"("tenant_id", "product_id", "warehouse_id");
CREATE INDEX "item_warehouse_policies_tenant_id_idx" ON "item_warehouse_policies"("tenant_id");
CREATE UNIQUE INDEX "replenishment_runs_tenant_id_run_number_key" ON "replenishment_runs"("tenant_id", "run_number");
CREATE INDEX "replenishment_runs_tenant_id_idx" ON "replenishment_runs"("tenant_id");
CREATE INDEX "replenishment_lines_tenant_id_idx" ON "replenishment_lines"("tenant_id");
CREATE INDEX "replenishment_lines_run_id_idx" ON "replenishment_lines"("run_id");
CREATE UNIQUE INDEX "operations_settings_tenant_id_key" ON "operations_settings"("tenant_id");
CREATE UNIQUE INDEX "statutory_settings_tenant_id_key" ON "statutory_settings"("tenant_id");
CREATE UNIQUE INDEX "wht_certificates_voucher_id_key" ON "wht_certificates"("voucher_id");
CREATE UNIQUE INDEX "wht_certificates_tenant_id_certificate_number_key" ON "wht_certificates"("tenant_id", "certificate_number");
CREATE INDEX "wht_certificates_tenant_id_idx" ON "wht_certificates"("tenant_id");

ALTER TABLE "item_warehouse_policies" ADD CONSTRAINT "item_warehouse_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_warehouse_policies" ADD CONSTRAINT "item_warehouse_policies_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_warehouse_policies" ADD CONSTRAINT "item_warehouse_policies_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "replenishment_runs" ADD CONSTRAINT "replenishment_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "replenishment_lines" ADD CONSTRAINT "replenishment_lines_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "replenishment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "replenishment_lines" ADD CONSTRAINT "replenishment_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "replenishment_lines" ADD CONSTRAINT "replenishment_lines_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "replenishment_lines" ADD CONSTRAINT "replenishment_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operations_settings" ADD CONSTRAINT "operations_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "statutory_settings" ADD CONSTRAINT "statutory_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wht_certificates" ADD CONSTRAINT "wht_certificates_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "payment_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wht_certificates" ADD CONSTRAINT "wht_certificates_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wht_certificates" ADD CONSTRAINT "wht_certificates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
