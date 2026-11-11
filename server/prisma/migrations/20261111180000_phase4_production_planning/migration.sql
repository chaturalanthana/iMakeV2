-- Phase 4 production planning: weekly MPS, substitutions, shop-floor capture,
-- yield and abnormal loss, WIP weights, absorption, contract manufacturing, genealogy.

ALTER TABLE "machines"
  ADD COLUMN IF NOT EXISTS "model_number" TEXT,
  ADD COLUMN IF NOT EXISTS "manufacturer" TEXT,
  ADD COLUMN IF NOT EXISTS "serial_number" TEXT,
  ADD COLUMN IF NOT EXISTS "watts" INTEGER,
  ADD COLUMN IF NOT EXISTS "year" INTEGER;

ALTER TABLE "products"
  ADD COLUMN "planning_policy" TEXT NOT NULL DEFAULT 'MAKE_TO_ORDER',
  ADD COLUMN "stock_target" DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN "manufacturing_lead_days" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "lot_policy" TEXT NOT NULL DEFAULT 'LOT_FOR_LOT',
  ADD COLUMN "fixed_lot_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN "min_lot_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN "standard_yield_percent" DECIMAL(9,4) NOT NULL DEFAULT 100,
  ADD COLUMN "abnormal_loss_threshold" DECIMAL(9,4) NOT NULL DEFAULT 2;

ALTER TABLE "product_groups"
  ADD COLUMN "standard_yield_percent" DECIMAL(9,4) NOT NULL DEFAULT 98,
  ADD COLUMN "standard_scrap_percent" DECIMAL(9,4) NOT NULL DEFAULT 2,
  ADD COLUMN "abnormal_loss_threshold" DECIMAL(9,4) NOT NULL DEFAULT 2;

ALTER TABLE "warehouses"
  ADD COLUMN "location_role" TEXT NOT NULL DEFAULT 'STORE',
  ADD COLUMN "supplier_id" TEXT;

CREATE INDEX "warehouses_supplier_id_idx" ON "warehouses"("supplier_id");

ALTER TABLE "warehouses"
  ADD CONSTRAINT "warehouses_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "routing_operations"
  ADD COLUMN "milestone_weight" DECIMAL(9,4) NOT NULL DEFAULT 0;

ALTER TABLE "work_orders"
  ADD COLUMN "teco_at" TIMESTAMP(3),
  ADD COLUMN "close_due_at" TIMESTAMP(3),
  ADD COLUMN "short_closed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "work_order_operations"
  ADD COLUMN "milestone_weight" DECIMAL(9,4) NOT NULL DEFAULT 0;

ALTER TABLE "work_order_issues"
  ADD COLUMN "issued_product_id" TEXT,
  ADD COLUMN "substitution_ratio" DECIMAL(19,4) NOT NULL DEFAULT 1,
  ADD COLUMN "substitution_delta" DECIMAL(19,4) NOT NULL DEFAULT 0;

ALTER TABLE "work_order_issues"
  ADD CONSTRAINT "work_order_issues_issued_product_id_fkey"
  FOREIGN KEY ("issued_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_settings"
  ADD COLUMN "close_grace_days" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "planning_horizon_weeks" INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN "labour_absorption_base" TEXT NOT NULL DEFAULT 'PER_LABOUR_HOUR',
  ADD COLUMN "overhead_absorption_base" TEXT NOT NULL DEFAULT 'PERCENT_OF_CONVERSION',
  ADD COLUMN "overhead_rate" DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN "abnormal_loss_threshold" DECIMAL(9,4) NOT NULL DEFAULT 2,
  ADD COLUMN "default_yield_percent" DECIMAL(9,4) NOT NULL DEFAULT 98,
  ADD COLUMN "default_scrap_percent" DECIMAL(9,4) NOT NULL DEFAULT 2;

CREATE TABLE "demand_forecasts" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "week_start" TIMESTAMP(3) NOT NULL,
  "quantity" DECIMAL(19,4) NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "demand_forecasts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mps_runs" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "horizon_weeks" INTEGER NOT NULL,
  "week_start" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT,
  CONSTRAINT "mps_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mps_buckets" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "week_start" TIMESTAMP(3) NOT NULL,
  "opening" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "forecast_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "order_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "demand_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "receipts_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "projected" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "safety_stock" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "stock_target" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "planned_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
  CONSTRAINT "mps_buckets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "planned_production_orders" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "run_id" TEXT,
  "product_id" TEXT NOT NULL,
  "quantity" DECIMAL(19,4) NOT NULL,
  "start_date" TIMESTAMP(3) NOT NULL,
  "due_date" TIMESTAMP(3) NOT NULL,
  "week_start" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "work_order_id" TEXT,
  "cost_center_id" TEXT,
  CONSTRAINT "planned_production_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bom_alternates" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "bom_item_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "ratio" DECIMAL(19,4) NOT NULL DEFAULT 1,
  "approved" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bom_alternates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "machine_captures" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "work_order_id" TEXT NOT NULL,
  "operation_id" TEXT NOT NULL,
  "machine_id" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL,
  "ended_at" TIMESTAMP(3) NOT NULL,
  "input_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "output_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "wastage_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "downtime_minutes" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "downtime_reason" TEXT,
  "rework_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "scrap_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "coproduct_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "byproduct_product_id" TEXT,
  "byproduct_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "lot_number" TEXT,
  "batch_id" TEXT,
  "yield_percent" DECIMAL(9,4) NOT NULL DEFAULT 0,
  "wastage_percent" DECIMAL(9,4) NOT NULL DEFAULT 0,
  "theoretical_yield_percent" DECIMAL(9,4) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT,
  CONSTRAINT "machine_captures_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract_orders" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "order_number" TEXT NOT NULL,
  "supplier_id" TEXT NOT NULL,
  "virtual_warehouse_id" TEXT NOT NULL,
  "fg_warehouse_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "work_order_id" TEXT,
  "quantity" DECIMAL(19,4) NOT NULL,
  "quantity_received" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "service_charge" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "supplier_invoice_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT,
  CONSTRAINT "contract_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract_issues" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "contract_order_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "quantity" DECIMAL(19,4) NOT NULL,
  "unit_cost" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "lot_number" TEXT,
  "warehouse_id" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'ISSUE',
  CONSTRAINT "contract_issues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "batch_genealogy" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "work_order_id" TEXT,
  "contract_order_id" TEXT,
  "confirmation_id" TEXT,
  "issue_id" TEXT,
  "fg_product_id" TEXT NOT NULL,
  "fg_lot_number" TEXT,
  "fg_batch_id" TEXT,
  "rm_product_id" TEXT NOT NULL,
  "rm_lot_number" TEXT,
  "rm_batch_id" TEXT,
  "quantity" DECIMAL(19,4) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "batch_genealogy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "abnormal_losses" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "work_order_id" TEXT NOT NULL,
  "product_line" TEXT,
  "actual_scrap_percent" DECIMAL(9,4) NOT NULL DEFAULT 0,
  "standard_scrap_percent" DECIMAL(9,4) NOT NULL DEFAULT 0,
  "threshold" DECIMAL(9,4) NOT NULL DEFAULT 0,
  "excess_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "approved_by" TEXT,
  "approved_at" TIMESTAMP(3),
  "journal_entry_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "abnormal_losses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_imports" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "description" TEXT,
  "total_debit" DECIMAL(19,4) NOT NULL,
  "journal_entry_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT,
  CONSTRAINT "payroll_imports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "overhead_reconciliations" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "cost_center_id" TEXT,
  "absorbed_labour" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "absorbed_overhead" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "actual_payroll" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "actual_overhead" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "labour_variance" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "overhead_variance" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "journal_entry_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "overhead_reconciliations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "demand_forecasts_tenant_id_product_id_week_start_key" ON "demand_forecasts"("tenant_id", "product_id", "week_start");
CREATE INDEX "demand_forecasts_tenant_id_idx" ON "demand_forecasts"("tenant_id");
CREATE INDEX "mps_runs_tenant_id_idx" ON "mps_runs"("tenant_id");
CREATE INDEX "mps_buckets_tenant_id_idx" ON "mps_buckets"("tenant_id");
CREATE INDEX "mps_buckets_run_id_idx" ON "mps_buckets"("run_id");
CREATE INDEX "planned_production_orders_tenant_id_idx" ON "planned_production_orders"("tenant_id");
CREATE INDEX "planned_production_orders_run_id_idx" ON "planned_production_orders"("run_id");
CREATE INDEX "planned_production_orders_status_idx" ON "planned_production_orders"("status");
CREATE UNIQUE INDEX "bom_alternates_bom_item_id_product_id_key" ON "bom_alternates"("bom_item_id", "product_id");
CREATE INDEX "bom_alternates_tenant_id_idx" ON "bom_alternates"("tenant_id");
CREATE INDEX "machine_captures_tenant_id_idx" ON "machine_captures"("tenant_id");
CREATE INDEX "machine_captures_work_order_id_idx" ON "machine_captures"("work_order_id");
CREATE UNIQUE INDEX "contract_orders_tenant_id_order_number_key" ON "contract_orders"("tenant_id", "order_number");
CREATE INDEX "contract_orders_tenant_id_idx" ON "contract_orders"("tenant_id");
CREATE INDEX "contract_issues_tenant_id_idx" ON "contract_issues"("tenant_id");
CREATE INDEX "contract_issues_contract_order_id_idx" ON "contract_issues"("contract_order_id");
CREATE INDEX "batch_genealogy_tenant_id_idx" ON "batch_genealogy"("tenant_id");
CREATE INDEX "batch_genealogy_work_order_id_idx" ON "batch_genealogy"("work_order_id");
CREATE INDEX "abnormal_losses_tenant_id_idx" ON "abnormal_losses"("tenant_id");
CREATE INDEX "abnormal_losses_work_order_id_idx" ON "abnormal_losses"("work_order_id");
CREATE INDEX "payroll_imports_tenant_id_idx" ON "payroll_imports"("tenant_id");
CREATE INDEX "overhead_reconciliations_tenant_id_idx" ON "overhead_reconciliations"("tenant_id");

ALTER TABLE "demand_forecasts" ADD CONSTRAINT "demand_forecasts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demand_forecasts" ADD CONSTRAINT "demand_forecasts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mps_runs" ADD CONSTRAINT "mps_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mps_buckets" ADD CONSTRAINT "mps_buckets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mps_buckets" ADD CONSTRAINT "mps_buckets_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "mps_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mps_buckets" ADD CONSTRAINT "mps_buckets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planned_production_orders" ADD CONSTRAINT "planned_production_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planned_production_orders" ADD CONSTRAINT "planned_production_orders_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "mps_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "planned_production_orders" ADD CONSTRAINT "planned_production_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planned_production_orders" ADD CONSTRAINT "planned_production_orders_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bom_alternates" ADD CONSTRAINT "bom_alternates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bom_alternates" ADD CONSTRAINT "bom_alternates_bom_item_id_fkey" FOREIGN KEY ("bom_item_id") REFERENCES "bom_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bom_alternates" ADD CONSTRAINT "bom_alternates_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "machine_captures" ADD CONSTRAINT "machine_captures_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "machine_captures" ADD CONSTRAINT "machine_captures_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "machine_captures" ADD CONSTRAINT "machine_captures_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "work_order_operations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "machine_captures" ADD CONSTRAINT "machine_captures_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "machine_captures" ADD CONSTRAINT "machine_captures_byproduct_product_id_fkey" FOREIGN KEY ("byproduct_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract_orders" ADD CONSTRAINT "contract_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_orders" ADD CONSTRAINT "contract_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_orders" ADD CONSTRAINT "contract_orders_virtual_warehouse_id_fkey" FOREIGN KEY ("virtual_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_orders" ADD CONSTRAINT "contract_orders_fg_warehouse_id_fkey" FOREIGN KEY ("fg_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_orders" ADD CONSTRAINT "contract_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_issues" ADD CONSTRAINT "contract_issues_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_issues" ADD CONSTRAINT "contract_issues_contract_order_id_fkey" FOREIGN KEY ("contract_order_id") REFERENCES "contract_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_issues" ADD CONSTRAINT "contract_issues_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_issues" ADD CONSTRAINT "contract_issues_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "batch_genealogy" ADD CONSTRAINT "batch_genealogy_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "batch_genealogy" ADD CONSTRAINT "batch_genealogy_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "batch_genealogy" ADD CONSTRAINT "batch_genealogy_contract_order_id_fkey" FOREIGN KEY ("contract_order_id") REFERENCES "contract_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "batch_genealogy" ADD CONSTRAINT "batch_genealogy_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "work_order_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "batch_genealogy" ADD CONSTRAINT "batch_genealogy_fg_product_id_fkey" FOREIGN KEY ("fg_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "batch_genealogy" ADD CONSTRAINT "batch_genealogy_rm_product_id_fkey" FOREIGN KEY ("rm_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "abnormal_losses" ADD CONSTRAINT "abnormal_losses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "abnormal_losses" ADD CONSTRAINT "abnormal_losses_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_imports" ADD CONSTRAINT "payroll_imports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "overhead_reconciliations" ADD CONSTRAINT "overhead_reconciliations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
