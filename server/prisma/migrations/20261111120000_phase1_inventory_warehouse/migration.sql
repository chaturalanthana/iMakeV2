-- AlterTable
ALTER TABLE "cost_layers" ADD COLUMN     "batch_id" TEXT,
ADD COLUMN     "bin_id" TEXT,
ADD COLUMN     "expiry_date" DATE,
ADD COLUMN     "pallet_id" TEXT,
ADD COLUMN     "stock_status" TEXT NOT NULL DEFAULT 'UNRESTRICTED';

-- AlterTable
ALTER TABLE "grn_items" ADD COLUMN     "damaged_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
ADD COLUMN     "expiry_date" DATE,
ADD COLUMN     "lot_number" TEXT,
ADD COLUMN     "pallet_code" TEXT,
ADD COLUMN     "rejected_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
ADD COLUMN     "stock_status" TEXT NOT NULL DEFAULT 'UNRESTRICTED';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "batch_tracked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "daily_demand" DECIMAL(19,4) NOT NULL DEFAULT 0,
ADD COLUMN     "expiry_tracked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "item_status" TEXT NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "lead_time_days" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "non_stock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pick_rule" TEXT NOT NULL DEFAULT 'FIFO',
ADD COLUMN     "size_label" TEXT,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "standard_description" TEXT,
ADD COLUMN     "uom_template_id" TEXT,
ADD COLUMN     "valuation_locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "variant" TEXT,
ADD COLUMN     "volume" DECIMAL(19,4),
ADD COLUMN     "weight" DECIMAL(19,4);

-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN     "base_quantity" DECIMAL(19,4),
ADD COLUMN     "conversion_factor" DECIMAL(19,6) NOT NULL DEFAULT 1,
ADD COLUMN     "uom_id" TEXT;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "batch_id" TEXT,
ADD COLUMN     "bin_id" TEXT,
ADD COLUMN     "pallet_id" TEXT,
ADD COLUMN     "stock_status" TEXT;

-- AlterTable
ALTER TABLE "warehouses" ADD COLUMN     "branch_id" TEXT,
ADD COLUMN     "is_virtual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tracks_pallets" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "warehouse_type" TEXT NOT NULL DEFAULT 'GENERAL';

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bins" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bin_type" TEXT NOT NULL DEFAULT 'STORAGE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uom_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uom_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uom_template_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "uom_code" TEXT NOT NULL,
    "factor_to_base" DECIMAL(19,6) NOT NULL,

    CONSTRAINT "uom_template_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_suppliers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pallets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "superseded_by_id" TEXT,
    "supersedes_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_batches" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "lot_number" TEXT NOT NULL,
    "expiry_date" DATE,
    "original_expiry_date" DATE,
    "manufactured_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'UNRESTRICTED',
    "qa_release_date" DATE,
    "retest_date" DATE,
    "retest_status" TEXT NOT NULL DEFAULT 'NONE',
    "proposed_expiry" DATE,
    "receipt_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplier_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qa_retests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "original_expiry" DATE,
    "proposed_expiry" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "evidence" TEXT,
    "requested_by" TEXT,
    "decided_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "qa_retests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_allocations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "warehouse_id" TEXT,
    "batch_id" TEXT,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_line_id" TEXT,
    "kind" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "released_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "mr_number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "required_date" TIMESTAMP(3),
    "requesting_party" TEXT NOT NULL,
    "purpose" TEXT,
    "source_warehouse_id" TEXT NOT NULL,
    "dest_warehouse_id" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approval_status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "material_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_request_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "mr_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "fulfilled_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,

    CONSTRAINT "material_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pick_lists" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "mr_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pick_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pick_list_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "pick_list_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "pallet_id" TEXT,
    "suggested_qty" DECIMAL(19,4) NOT NULL,
    "confirmed_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,

    CONSTRAINT "pick_list_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transfers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transfer_number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "from_warehouse_id" TEXT NOT NULL,
    "to_warehouse_id" TEXT NOT NULL,
    "mr_id" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'IMMEDIATE',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "inventory_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transfer_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "batch_id" TEXT,
    "pallet_id" TEXT,
    "uom_id" TEXT,
    "unit_cost" DECIMAL(19,4) NOT NULL DEFAULT 0,

    CONSTRAINT "inventory_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transfer_legs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "pallet_id" TEXT,
    "quantity" DECIMAL(19,4) NOT NULL,
    "quantity_remaining" DECIMAL(19,4) NOT NULL,
    "unit_cost" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "inventory_transfer_legs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_returns" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "return_number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "customer_id" TEXT,
    "supplier_id" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "stock_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_return_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "return_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "batch_id" TEXT,
    "reason" TEXT NOT NULL,
    "disposition" TEXT NOT NULL,
    "unit_cost" DECIMAL(19,4) NOT NULL DEFAULT 0,

    CONSTRAINT "stock_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_counts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "count_number" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CYCLE',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "finance_status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "cycle_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_count_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "count_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "book_qty" DECIMAL(19,4) NOT NULL,
    "count_qty" DECIMAL(19,4) NOT NULL,
    "recount_qty" DECIMAL(19,4),
    "reason" TEXT,
    "variance_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "variance_value" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(19,4) NOT NULL DEFAULT 0,

    CONSTRAINT "cycle_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "branches_tenant_id_idx" ON "branches"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "branches_tenant_id_code_key" ON "branches"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "bins_tenant_id_idx" ON "bins"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "bins_tenant_id_warehouse_id_code_key" ON "bins"("tenant_id", "warehouse_id", "code");

-- CreateIndex
CREATE INDEX "uom_templates_tenant_id_idx" ON "uom_templates"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "uom_templates_tenant_id_code_key" ON "uom_templates"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "uom_template_lines_tenant_id_idx" ON "uom_template_lines"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "uom_template_lines_template_id_uom_code_key" ON "uom_template_lines"("template_id", "uom_code");

-- CreateIndex
CREATE INDEX "item_suppliers_tenant_id_idx" ON "item_suppliers"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_suppliers_tenant_id_product_id_supplier_id_key" ON "item_suppliers"("tenant_id", "product_id", "supplier_id");

-- CreateIndex
CREATE INDEX "pallets_tenant_id_idx" ON "pallets"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "pallets_tenant_id_code_key" ON "pallets"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "stock_batches_tenant_id_idx" ON "stock_batches"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_batches_tenant_id_product_id_lot_number_key" ON "stock_batches"("tenant_id", "product_id", "lot_number");

-- CreateIndex
CREATE INDEX "qa_retests_tenant_id_idx" ON "qa_retests"("tenant_id");

-- CreateIndex
CREATE INDEX "qa_retests_batch_id_idx" ON "qa_retests"("batch_id");

-- CreateIndex
CREATE INDEX "stock_allocations_tenant_id_product_id_idx" ON "stock_allocations"("tenant_id", "product_id");

-- CreateIndex
CREATE INDEX "stock_allocations_tenant_id_source_type_source_id_idx" ON "stock_allocations"("tenant_id", "source_type", "source_id");

-- CreateIndex
CREATE INDEX "material_requests_tenant_id_idx" ON "material_requests"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_requests_tenant_id_mr_number_key" ON "material_requests"("tenant_id", "mr_number");

-- CreateIndex
CREATE INDEX "material_request_items_tenant_id_idx" ON "material_request_items"("tenant_id");

-- CreateIndex
CREATE INDEX "material_request_items_mr_id_idx" ON "material_request_items"("mr_id");

-- CreateIndex
CREATE INDEX "pick_lists_tenant_id_idx" ON "pick_lists"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "pick_lists_tenant_id_number_key" ON "pick_lists"("tenant_id", "number");

-- CreateIndex
CREATE INDEX "pick_list_lines_tenant_id_idx" ON "pick_list_lines"("tenant_id");

-- CreateIndex
CREATE INDEX "pick_list_lines_pick_list_id_idx" ON "pick_list_lines"("pick_list_id");

-- CreateIndex
CREATE INDEX "inventory_transfers_tenant_id_idx" ON "inventory_transfers"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_transfers_tenant_id_transfer_number_key" ON "inventory_transfers"("tenant_id", "transfer_number");

-- CreateIndex
CREATE INDEX "inventory_transfer_items_tenant_id_idx" ON "inventory_transfer_items"("tenant_id");

-- CreateIndex
CREATE INDEX "inventory_transfer_items_transfer_id_idx" ON "inventory_transfer_items"("transfer_id");

-- CreateIndex
CREATE INDEX "inventory_transfer_legs_tenant_id_idx" ON "inventory_transfer_legs"("tenant_id");

-- CreateIndex
CREATE INDEX "inventory_transfer_legs_transfer_id_idx" ON "inventory_transfer_legs"("transfer_id");

-- CreateIndex
CREATE INDEX "stock_returns_tenant_id_idx" ON "stock_returns"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_returns_tenant_id_return_number_key" ON "stock_returns"("tenant_id", "return_number");

-- CreateIndex
CREATE INDEX "stock_return_items_tenant_id_idx" ON "stock_return_items"("tenant_id");

-- CreateIndex
CREATE INDEX "stock_return_items_return_id_idx" ON "stock_return_items"("return_id");

-- CreateIndex
CREATE INDEX "cycle_counts_tenant_id_idx" ON "cycle_counts"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_counts_tenant_id_count_number_key" ON "cycle_counts"("tenant_id", "count_number");

-- CreateIndex
CREATE INDEX "cycle_count_lines_tenant_id_idx" ON "cycle_count_lines"("tenant_id");

-- CreateIndex
CREATE INDEX "cycle_count_lines_count_id_idx" ON "cycle_count_lines"("count_id");

-- CreateIndex
CREATE INDEX "products_tenant_id_barcode_idx" ON "products"("tenant_id", "barcode");

-- CreateIndex
CREATE INDEX "products_tenant_id_sku_idx" ON "products"("tenant_id", "sku");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_uom_template_id_fkey" FOREIGN KEY ("uom_template_id") REFERENCES "uom_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "unit_of_measures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bins" ADD CONSTRAINT "bins_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bins" ADD CONSTRAINT "bins_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uom_templates" ADD CONSTRAINT "uom_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uom_template_lines" ADD CONSTRAINT "uom_template_lines_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "uom_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uom_template_lines" ADD CONSTRAINT "uom_template_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_suppliers" ADD CONSTRAINT "item_suppliers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_suppliers" ADD CONSTRAINT "item_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_suppliers" ADD CONSTRAINT "item_suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pallets" ADD CONSTRAINT "pallets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pallets" ADD CONSTRAINT "pallets_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pallets" ADD CONSTRAINT "pallets_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "pallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qa_retests" ADD CONSTRAINT "qa_retests_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "stock_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qa_retests" ADD CONSTRAINT "qa_retests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_allocations" ADD CONSTRAINT "stock_allocations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_allocations" ADD CONSTRAINT "stock_allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_source_warehouse_id_fkey" FOREIGN KEY ("source_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_dest_warehouse_id_fkey" FOREIGN KEY ("dest_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_items" ADD CONSTRAINT "material_request_items_mr_id_fkey" FOREIGN KEY ("mr_id") REFERENCES "material_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_items" ADD CONSTRAINT "material_request_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_items" ADD CONSTRAINT "material_request_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_lists" ADD CONSTRAINT "pick_lists_mr_id_fkey" FOREIGN KEY ("mr_id") REFERENCES "material_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_lists" ADD CONSTRAINT "pick_lists_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_list_lines" ADD CONSTRAINT "pick_list_lines_pick_list_id_fkey" FOREIGN KEY ("pick_list_id") REFERENCES "pick_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_list_lines" ADD CONSTRAINT "pick_list_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_list_lines" ADD CONSTRAINT "pick_list_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_from_warehouse_id_fkey" FOREIGN KEY ("from_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_to_warehouse_id_fkey" FOREIGN KEY ("to_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_items" ADD CONSTRAINT "inventory_transfer_items_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "inventory_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_items" ADD CONSTRAINT "inventory_transfer_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_items" ADD CONSTRAINT "inventory_transfer_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_legs" ADD CONSTRAINT "inventory_transfer_legs_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "inventory_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_legs" ADD CONSTRAINT "inventory_transfer_legs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_legs" ADD CONSTRAINT "inventory_transfer_legs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_returns" ADD CONSTRAINT "stock_returns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_returns" ADD CONSTRAINT "stock_returns_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_returns" ADD CONSTRAINT "stock_returns_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_returns" ADD CONSTRAINT "stock_returns_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_return_items" ADD CONSTRAINT "stock_return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "stock_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_return_items" ADD CONSTRAINT "stock_return_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_return_items" ADD CONSTRAINT "stock_return_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_counts" ADD CONSTRAINT "cycle_counts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_counts" ADD CONSTRAINT "cycle_counts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_count_lines" ADD CONSTRAINT "cycle_count_lines_count_id_fkey" FOREIGN KEY ("count_id") REFERENCES "cycle_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_count_lines" ADD CONSTRAINT "cycle_count_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_count_lines" ADD CONSTRAINT "cycle_count_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

