-- AlterTable
ALTER TABLE "journal_lines" ADD COLUMN     "cost_center_id" TEXT,
ADD COLUMN     "profit_center_id" TEXT;

-- CreateTable
CREATE TABLE "finance_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "capitalization_threshold" DECIMAL(19,4) NOT NULL DEFAULT 100000,
    "price_tolerance_percent" DECIMAL(9,4) NOT NULL DEFAULT 2,
    "default_allocation_basis" TEXT NOT NULL DEFAULT 'VALUE',
    "wht_stage" TEXT NOT NULL DEFAULT 'PAYMENT',
    "svat_enabled" BOOLEAN NOT NULL DEFAULT false,
    "block_missing_supplier_tax" BOOLEAN NOT NULL DEFAULT false,
    "base_currency" TEXT NOT NULL DEFAULT 'LKR',
    "foreign_currency" TEXT NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_centers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'BOTH',
    "is_administration" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL DEFAULT 0,
    "account_id" TEXT,
    "cost_center_id" TEXT,
    "capital_project_id" TEXT,
    "amount" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation_rules" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source_account_id" TEXT NOT NULL,
    "source_center_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allocation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation_rule_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "target_cost_center_id" TEXT NOT NULL,
    "percent" DECIMAL(9,4) NOT NULL,

    CONSTRAINT "allocation_rule_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capital_projects" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "budget_amount" DECIMAL(19,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "cost_center_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capital_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_classifications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "spend_class" TEXT NOT NULL,
    "gl_account_id" TEXT,
    "cost_center_id" TEXT,
    "profit_center_id" TEXT,
    "capital_project_id" TEXT,
    "treatment" TEXT NOT NULL,
    "budget_status" TEXT NOT NULL,
    "override_reason" TEXT,
    "amount_base" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approved_supplier_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approved_supplier_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_prices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'LKR',
    "unit_price" DECIMAL(19,4) NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3),
    "tolerance_percent" DECIMAL(9,4),
    "minimum_order_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_exceptions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "po_id" TEXT,
    "product_id" TEXT NOT NULL,
    "agreed_price" DECIMAL(19,4) NOT NULL,
    "actual_price" DECIMAL(19,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requests_for_quotation" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "rfq_number" TEXT NOT NULL,
    "pr_id" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "cost_center_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requests_for_quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfq_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "rfq_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "rfq_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfq_invitations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "rfq_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,

    CONSTRAINT "rfq_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_quotations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "quote_number" TEXT NOT NULL,
    "rfq_id" TEXT,
    "supplier_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'LKR',
    "exchange_rate" DECIMAL(19,4) NOT NULL DEFAULT 1,
    "valid_until" TIMESTAMP(3),
    "lead_time_days" INTEGER NOT NULL DEFAULT 0,
    "quality_note" TEXT,
    "terms" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_quotation_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "total" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "supplier_quotation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_selections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "rfq_id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "quotation_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_profiles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "trade_type" TEXT NOT NULL,
    "shipment_ref" TEXT,
    "approval_path" TEXT NOT NULL,
    "currency_code" TEXT,
    "exchange_rate" DECIMAL(19,4) NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_dimensions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "cost_center_id" TEXT,
    "profit_center_id" TEXT,

    CONSTRAINT "document_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_measures" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "weight_kg" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "volume_cbm" DECIMAL(19,4) NOT NULL DEFAULT 0,

    CONSTRAINT "item_measures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landed_costs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "grn_id" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "grn_exchange_rate" DECIMAL(19,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "landed_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landed_cost_charges" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "landed_cost_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "exchange_rate" DECIMAL(19,4) NOT NULL,
    "amount_base" DECIMAL(19,4) NOT NULL,
    "reference" TEXT,

    CONSTRAINT "landed_cost_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landed_cost_allocations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "landed_cost_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "grn_item_id" TEXT,
    "quantity" DECIMAL(19,4) NOT NULL,
    "weight" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "value_base" DECIMAL(19,4) NOT NULL,
    "allocated_base" DECIMAL(19,4) NOT NULL,
    "inventory_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "cogs_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "fx_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,

    CONSTRAINT "landed_cost_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixed_asset_classes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accounting_method" TEXT NOT NULL DEFAULT 'SL',
    "accounting_life_months" INTEGER NOT NULL DEFAULT 60,
    "accounting_rate" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "accounting_residual" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_method" TEXT NOT NULL DEFAULT 'RB',
    "tax_life_months" INTEGER NOT NULL DEFAULT 60,
    "tax_rate" DECIMAL(9,4) NOT NULL DEFAULT 20,
    "tax_residual" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fixed_asset_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixed_assets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "class_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CWIP',
    "acquired_on" TIMESTAMP(3) NOT NULL,
    "disposed_on" TIMESTAMP(3),
    "cost" DECIMAL(19,4) NOT NULL,
    "cwip_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "accounting_nbv" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_nbv" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "accum_depreciation" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "cost_center_id" TEXT,
    "profit_center_id" TEXT,
    "capital_project_id" TEXT,
    "source_grn_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fixed_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depreciation_runs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "journal_entry_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "depreciation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depreciation_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "book" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "nbv_after" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "depreciation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "journal_entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_notes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "note_number" TEXT NOT NULL,
    "party_type" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "invoice_id" TEXT,
    "invoice_number" TEXT,
    "reason_code" TEXT NOT NULL,
    "subtotal" DECIMAL(19,4) NOT NULL,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(19,4) NOT NULL,
    "exchange_rate" DECIMAL(19,4) NOT NULL DEFAULT 1,
    "cost_center_id" TEXT,
    "profit_center_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "party_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_cases" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "dispute_status" TEXT NOT NULL DEFAULT 'NONE',
    "promised_date" TIMESTAMP(3),
    "last_contact" TIMESTAMP(3),
    "notes" TEXT,
    "collector" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_activities" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "body" TEXT NOT NULL,
    "promised_date" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cheques" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "cheque_number" TEXT NOT NULL,
    "cheque_date" TIMESTAMP(3) NOT NULL,
    "payee" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "party_id" TEXT,
    "voucher_id" TEXT,
    "receipt_id" TEXT,
    "invoice_id" TEXT,
    "bank_account_id" TEXT,
    "amount" DECIMAL(19,4) NOT NULL,
    "exchange_rate" DECIMAL(19,4) NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'UNREALISED',
    "is_pdc" BOOLEAN NOT NULL DEFAULT false,
    "realised" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cheques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "petty_cash_funds" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "custodian" TEXT,
    "balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "petty_cash_funds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iou_advances" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "employee_id" TEXT,
    "employee_name" TEXT NOT NULL,
    "department" TEXT,
    "amount" DECIMAL(19,4) NOT NULL,
    "settled" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "fund_id" TEXT,
    "source" TEXT NOT NULL DEFAULT 'PETTY_CASH',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iou_advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iou_settlements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "iou_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "kind" TEXT NOT NULL,
    "expense_account_id" TEXT,
    "description" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iou_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_journals" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lines" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "period_closes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "exception_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "period_closes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "period_close_steps" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "close_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "period_close_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "finance_settings_tenant_id_key" ON "finance_settings"("tenant_id");

-- CreateIndex
CREATE INDEX "org_centers_tenant_id_idx" ON "org_centers"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_centers_tenant_id_code_key" ON "org_centers"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "budgets_tenant_id_idx" ON "budgets"("tenant_id");

-- CreateIndex
CREATE INDEX "allocation_rules_tenant_id_idx" ON "allocation_rules"("tenant_id");

-- CreateIndex
CREATE INDEX "allocation_rule_lines_tenant_id_idx" ON "allocation_rule_lines"("tenant_id");

-- CreateIndex
CREATE INDEX "allocation_rule_lines_rule_id_idx" ON "allocation_rule_lines"("rule_id");

-- CreateIndex
CREATE INDEX "capital_projects_tenant_id_idx" ON "capital_projects"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "capital_projects_tenant_id_code_key" ON "capital_projects"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "purchase_classifications_tenant_id_idx" ON "purchase_classifications"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_classifications_tenant_id_document_type_document_i_key" ON "purchase_classifications"("tenant_id", "document_type", "document_id");

-- CreateIndex
CREATE INDEX "approved_supplier_items_tenant_id_idx" ON "approved_supplier_items"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "approved_supplier_items_tenant_id_supplier_id_product_id_key" ON "approved_supplier_items"("tenant_id", "supplier_id", "product_id");

-- CreateIndex
CREATE INDEX "contract_prices_tenant_id_idx" ON "contract_prices"("tenant_id");

-- CreateIndex
CREATE INDEX "contract_prices_supplier_id_idx" ON "contract_prices"("supplier_id");

-- CreateIndex
CREATE INDEX "price_exceptions_tenant_id_idx" ON "price_exceptions"("tenant_id");

-- CreateIndex
CREATE INDEX "requests_for_quotation_tenant_id_idx" ON "requests_for_quotation"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "requests_for_quotation_tenant_id_rfq_number_key" ON "requests_for_quotation"("tenant_id", "rfq_number");

-- CreateIndex
CREATE INDEX "rfq_lines_tenant_id_idx" ON "rfq_lines"("tenant_id");

-- CreateIndex
CREATE INDEX "rfq_lines_rfq_id_idx" ON "rfq_lines"("rfq_id");

-- CreateIndex
CREATE INDEX "rfq_invitations_tenant_id_idx" ON "rfq_invitations"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "rfq_invitations_rfq_id_supplier_id_key" ON "rfq_invitations"("rfq_id", "supplier_id");

-- CreateIndex
CREATE INDEX "supplier_quotations_tenant_id_idx" ON "supplier_quotations"("tenant_id");

-- CreateIndex
CREATE INDEX "supplier_quotations_rfq_id_idx" ON "supplier_quotations"("rfq_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_quotations_tenant_id_quote_number_key" ON "supplier_quotations"("tenant_id", "quote_number");

-- CreateIndex
CREATE INDEX "supplier_quotation_lines_tenant_id_idx" ON "supplier_quotation_lines"("tenant_id");

-- CreateIndex
CREATE INDEX "supplier_quotation_lines_quotation_id_idx" ON "supplier_quotation_lines"("quotation_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_selections_rfq_id_key" ON "quotation_selections"("rfq_id");

-- CreateIndex
CREATE INDEX "quotation_selections_tenant_id_idx" ON "quotation_selections"("tenant_id");

-- CreateIndex
CREATE INDEX "trade_profiles_tenant_id_idx" ON "trade_profiles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "trade_profiles_tenant_id_document_type_document_id_key" ON "trade_profiles"("tenant_id", "document_type", "document_id");

-- CreateIndex
CREATE INDEX "document_dimensions_tenant_id_idx" ON "document_dimensions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_dimensions_tenant_id_document_type_document_id_key" ON "document_dimensions"("tenant_id", "document_type", "document_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_measures_tenant_id_product_id_key" ON "item_measures"("tenant_id", "product_id");

-- CreateIndex
CREATE INDEX "landed_costs_tenant_id_idx" ON "landed_costs"("tenant_id");

-- CreateIndex
CREATE INDEX "landed_costs_grn_id_idx" ON "landed_costs"("grn_id");

-- CreateIndex
CREATE UNIQUE INDEX "landed_costs_tenant_id_number_key" ON "landed_costs"("tenant_id", "number");

-- CreateIndex
CREATE INDEX "landed_cost_charges_tenant_id_idx" ON "landed_cost_charges"("tenant_id");

-- CreateIndex
CREATE INDEX "landed_cost_charges_landed_cost_id_idx" ON "landed_cost_charges"("landed_cost_id");

-- CreateIndex
CREATE INDEX "landed_cost_allocations_tenant_id_idx" ON "landed_cost_allocations"("tenant_id");

-- CreateIndex
CREATE INDEX "landed_cost_allocations_landed_cost_id_idx" ON "landed_cost_allocations"("landed_cost_id");

-- CreateIndex
CREATE INDEX "fixed_asset_classes_tenant_id_idx" ON "fixed_asset_classes"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "fixed_asset_classes_tenant_id_code_key" ON "fixed_asset_classes"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "fixed_assets_tenant_id_idx" ON "fixed_assets"("tenant_id");

-- CreateIndex
CREATE INDEX "fixed_assets_source_grn_id_idx" ON "fixed_assets"("source_grn_id");

-- CreateIndex
CREATE UNIQUE INDEX "fixed_assets_tenant_id_code_key" ON "fixed_assets"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "depreciation_runs_tenant_id_idx" ON "depreciation_runs"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "depreciation_runs_tenant_id_year_month_key" ON "depreciation_runs"("tenant_id", "year", "month");

-- CreateIndex
CREATE INDEX "depreciation_lines_tenant_id_idx" ON "depreciation_lines"("tenant_id");

-- CreateIndex
CREATE INDEX "depreciation_lines_run_id_idx" ON "depreciation_lines"("run_id");

-- CreateIndex
CREATE INDEX "depreciation_lines_asset_id_idx" ON "depreciation_lines"("asset_id");

-- CreateIndex
CREATE INDEX "asset_events_tenant_id_idx" ON "asset_events"("tenant_id");

-- CreateIndex
CREATE INDEX "asset_events_asset_id_idx" ON "asset_events"("asset_id");

-- CreateIndex
CREATE INDEX "party_notes_tenant_id_idx" ON "party_notes"("tenant_id");

-- CreateIndex
CREATE INDEX "party_notes_party_id_idx" ON "party_notes"("party_id");

-- CreateIndex
CREATE UNIQUE INDEX "party_notes_tenant_id_note_number_key" ON "party_notes"("tenant_id", "note_number");

-- CreateIndex
CREATE INDEX "collection_cases_tenant_id_idx" ON "collection_cases"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_cases_tenant_id_customer_id_key" ON "collection_cases"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "collection_activities_tenant_id_idx" ON "collection_activities"("tenant_id");

-- CreateIndex
CREATE INDEX "collection_activities_customer_id_idx" ON "collection_activities"("customer_id");

-- CreateIndex
CREATE INDEX "cheques_tenant_id_idx" ON "cheques"("tenant_id");

-- CreateIndex
CREATE INDEX "cheques_cheque_number_idx" ON "cheques"("cheque_number");

-- CreateIndex
CREATE INDEX "petty_cash_funds_tenant_id_idx" ON "petty_cash_funds"("tenant_id");

-- CreateIndex
CREATE INDEX "iou_advances_tenant_id_idx" ON "iou_advances"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "iou_advances_tenant_id_reference_key" ON "iou_advances"("tenant_id", "reference");

-- CreateIndex
CREATE INDEX "iou_settlements_tenant_id_idx" ON "iou_settlements"("tenant_id");

-- CreateIndex
CREATE INDEX "iou_settlements_iou_id_idx" ON "iou_settlements"("iou_id");

-- CreateIndex
CREATE INDEX "recurring_journals_tenant_id_idx" ON "recurring_journals"("tenant_id");

-- CreateIndex
CREATE INDEX "period_closes_tenant_id_idx" ON "period_closes"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "period_closes_tenant_id_year_month_key" ON "period_closes"("tenant_id", "year", "month");

-- CreateIndex
CREATE INDEX "period_close_steps_tenant_id_idx" ON "period_close_steps"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "period_close_steps_close_id_code_key" ON "period_close_steps"("close_id", "code");

-- AddForeignKey
ALTER TABLE "finance_settings" ADD CONSTRAINT "finance_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_centers" ADD CONSTRAINT "org_centers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_rules" ADD CONSTRAINT "allocation_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_rule_lines" ADD CONSTRAINT "allocation_rule_lines_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "allocation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_rule_lines" ADD CONSTRAINT "allocation_rule_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capital_projects" ADD CONSTRAINT "capital_projects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_classifications" ADD CONSTRAINT "purchase_classifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approved_supplier_items" ADD CONSTRAINT "approved_supplier_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_prices" ADD CONSTRAINT "contract_prices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_exceptions" ADD CONSTRAINT "price_exceptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests_for_quotation" ADD CONSTRAINT "requests_for_quotation_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_lines" ADD CONSTRAINT "rfq_lines_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "requests_for_quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_lines" ADD CONSTRAINT "rfq_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_invitations" ADD CONSTRAINT "rfq_invitations_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "requests_for_quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_invitations" ADD CONSTRAINT "rfq_invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quotations" ADD CONSTRAINT "supplier_quotations_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "requests_for_quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quotations" ADD CONSTRAINT "supplier_quotations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quotation_lines" ADD CONSTRAINT "supplier_quotation_lines_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "supplier_quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quotation_lines" ADD CONSTRAINT "supplier_quotation_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_selections" ADD CONSTRAINT "quotation_selections_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "requests_for_quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_selections" ADD CONSTRAINT "quotation_selections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_profiles" ADD CONSTRAINT "trade_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_dimensions" ADD CONSTRAINT "document_dimensions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_measures" ADD CONSTRAINT "item_measures_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landed_costs" ADD CONSTRAINT "landed_costs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landed_cost_charges" ADD CONSTRAINT "landed_cost_charges_landed_cost_id_fkey" FOREIGN KEY ("landed_cost_id") REFERENCES "landed_costs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landed_cost_charges" ADD CONSTRAINT "landed_cost_charges_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landed_cost_allocations" ADD CONSTRAINT "landed_cost_allocations_landed_cost_id_fkey" FOREIGN KEY ("landed_cost_id") REFERENCES "landed_costs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landed_cost_allocations" ADD CONSTRAINT "landed_cost_allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_asset_classes" ADD CONSTRAINT "fixed_asset_classes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "fixed_asset_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_runs" ADD CONSTRAINT "depreciation_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_lines" ADD CONSTRAINT "depreciation_lines_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "depreciation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_lines" ADD CONSTRAINT "depreciation_lines_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "fixed_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_lines" ADD CONSTRAINT "depreciation_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_events" ADD CONSTRAINT "asset_events_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "fixed_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_events" ADD CONSTRAINT "asset_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_notes" ADD CONSTRAINT "party_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_cases" ADD CONSTRAINT "collection_cases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_activities" ADD CONSTRAINT "collection_activities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petty_cash_funds" ADD CONSTRAINT "petty_cash_funds_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iou_advances" ADD CONSTRAINT "iou_advances_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "petty_cash_funds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iou_advances" ADD CONSTRAINT "iou_advances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iou_settlements" ADD CONSTRAINT "iou_settlements_iou_id_fkey" FOREIGN KEY ("iou_id") REFERENCES "iou_advances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iou_settlements" ADD CONSTRAINT "iou_settlements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_journals" ADD CONSTRAINT "recurring_journals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_closes" ADD CONSTRAINT "period_closes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_close_steps" ADD CONSTRAINT "period_close_steps_close_id_fkey" FOREIGN KEY ("close_id") REFERENCES "period_closes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_close_steps" ADD CONSTRAINT "period_close_steps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

