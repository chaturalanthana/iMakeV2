-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "channel" TEXT DEFAULT 'GENERAL_TRADE',
ADD COLUMN     "external_ref" TEXT;

-- AlterTable
ALTER TABLE "sales_invoices" ADD COLUMN     "channel" TEXT,
ADD COLUMN     "external_ref" TEXT,
ADD COLUMN     "sale_kind" TEXT DEFAULT 'CREDIT',
ADD COLUMN     "stock_posted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "warehouse_id" TEXT;

-- AlterTable
ALTER TABLE "sales_order_items" ADD COLUMN     "cancelled_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
ADD COLUMN     "discount_percent" DECIMAL(9,4) NOT NULL DEFAULT 0,
ADD COLUMN     "list_price" DECIMAL(19,4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'GENERAL_TRADE',
ADD COLUMN     "discount_percent" DECIMAL(9,4) NOT NULL DEFAULT 0,
ADD COLUMN     "external_ref" TEXT,
ADD COLUMN     "released_at" TIMESTAMP(3),
ADD COLUMN     "released_by" TEXT,
ADD COLUMN     "route_id" TEXT,
ADD COLUMN     "ship_to_id" TEXT,
ADD COLUMN     "source_system" TEXT,
ADD COLUMN     "vehicle_id" TEXT,
ADD COLUMN     "warehouse_id" TEXT;

-- CreateTable
CREATE TABLE "dispatch_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "max_discount_percent" DECIMAL(9,4) NOT NULL DEFAULT 10,
    "block_credit_over_limit" BOOLEAN NOT NULL DEFAULT true,
    "block_overdue" BOOLEAN NOT NULL DEFAULT true,
    "shortage_policy" TEXT NOT NULL DEFAULT 'ALLOW_PARTIAL',
    "sfa_reservation" TEXT NOT NULL DEFAULT 'HARD',
    "sfa_sync_minutes" INTEGER NOT NULL DEFAULT 15,
    "sfa_import_orders" BOOLEAN NOT NULL DEFAULT true,
    "sfa_import_customers" BOOLEAN NOT NULL DEFAULT true,
    "sfa_import_collections" BOOLEAN NOT NULL DEFAULT true,
    "sfa_export_items" BOOLEAN NOT NULL DEFAULT true,
    "sfa_export_prices" BOOLEAN NOT NULL DEFAULT true,
    "sfa_export_stock" BOOLEAN NOT NULL DEFAULT true,
    "sfa_export_balances" BOOLEAN NOT NULL DEFAULT true,
    "gate_pass_required" BOOLEAN NOT NULL DEFAULT true,
    "invoice_before_dispatch" BOOLEAN NOT NULL DEFAULT true,
    "email_hook_enabled" BOOLEAN NOT NULL DEFAULT false,
    "email_hook_url" TEXT,
    "bankColumns" JSONB,

    CONSTRAINT "dispatch_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ship_tos" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ship_tos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_routes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "warehouse_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "delivery_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "driver_name" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'TRUCK',
    "warehouse_id" TEXT,
    "route_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_prices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "customer_id" TEXT,
    "customer_category_id" TEXT,
    "channel" TEXT,
    "product_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "uom" TEXT,
    "min_qty" DECIMAL(19,4) NOT NULL DEFAULT 1,
    "price" DECIMAL(19,4) NOT NULL,
    "valid_from" TIMESTAMP(3),
    "valid_to" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "customer_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_reservations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "warehouse_id" TEXT,
    "quantity" DECIMAL(19,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_picks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "route_id" TEXT,
    "vehicle_id" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "route_picks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_pick_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "pick_id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "picked_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "packed_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,

    CONSTRAINT "route_pick_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_pick_orders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "pick_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,

    CONSTRAINT "route_pick_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_sheets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "route_id" TEXT,
    "vehicle_id" TEXT,
    "pick_id" TEXT,
    "driver_name" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "trip_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_deliveries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,

    CONSTRAINT "trip_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_passes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "vehicle_id" TEXT,
    "driver_name" TEXT,
    "security_name" TEXT,
    "load_note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "issued_at" TIMESTAMP(3),
    "issued_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gate_passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proofs_of_delivery" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "trip_id" TEXT,
    "received_by" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DELIVERED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "proofs_of_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "proof_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "delivered_qty" DECIMAL(19,4) NOT NULL,
    "rejected_qty" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "reason" TEXT,

    CONSTRAINT "proof_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_returns" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "delivery_id" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "stock_return_id" TEXT,
    "party_note_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "sales_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_return_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "return_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "unit_cost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "reason" TEXT,

    CONSTRAINT "sales_return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_cancellations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_item_id" TEXT,
    "quantity" DECIMAL(19,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_cancellations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sfa_api_keys" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sfa_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sfa_messages" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "external_ref" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "result_id" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sfa_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_file_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Collection file',
    "columns" JSONB NOT NULL,

    CONSTRAINT "bank_file_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_file_exports" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "template_id" TEXT,

    CONSTRAINT "bank_file_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_notifications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "read_at" TIMESTAMP(3),
    "email_status" TEXT NOT NULL DEFAULT 'SKIPPED',
    "email_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dispatch_settings_tenant_id_key" ON "dispatch_settings"("tenant_id");

-- CreateIndex
CREATE INDEX "ship_tos_tenant_id_idx" ON "ship_tos"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "ship_tos_tenant_id_customer_id_code_key" ON "ship_tos"("tenant_id", "customer_id", "code");

-- CreateIndex
CREATE INDEX "delivery_routes_tenant_id_idx" ON "delivery_routes"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_routes_tenant_id_code_key" ON "delivery_routes"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "vehicles_tenant_id_idx" ON "vehicles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_tenant_id_code_key" ON "vehicles"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "customer_prices_tenant_id_product_id_scope_idx" ON "customer_prices"("tenant_id", "product_id", "scope");

-- CreateIndex
CREATE INDEX "sales_reservations_tenant_id_product_id_status_idx" ON "sales_reservations"("tenant_id", "product_id", "status");

-- CreateIndex
CREATE INDEX "sales_reservations_order_id_idx" ON "sales_reservations"("order_id");

-- CreateIndex
CREATE INDEX "route_picks_tenant_id_idx" ON "route_picks"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "route_picks_tenant_id_number_key" ON "route_picks"("tenant_id", "number");

-- CreateIndex
CREATE INDEX "route_pick_lines_tenant_id_idx" ON "route_pick_lines"("tenant_id");

-- CreateIndex
CREATE INDEX "route_pick_lines_pick_id_idx" ON "route_pick_lines"("pick_id");

-- CreateIndex
CREATE INDEX "route_pick_orders_tenant_id_idx" ON "route_pick_orders"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "route_pick_orders_pick_id_order_id_key" ON "route_pick_orders"("pick_id", "order_id");

-- CreateIndex
CREATE INDEX "trip_sheets_tenant_id_idx" ON "trip_sheets"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_sheets_tenant_id_number_key" ON "trip_sheets"("tenant_id", "number");

-- CreateIndex
CREATE INDEX "trip_deliveries_tenant_id_idx" ON "trip_deliveries"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_deliveries_trip_id_delivery_id_key" ON "trip_deliveries"("trip_id", "delivery_id");

-- CreateIndex
CREATE UNIQUE INDEX "gate_passes_trip_id_key" ON "gate_passes"("trip_id");

-- CreateIndex
CREATE INDEX "gate_passes_tenant_id_idx" ON "gate_passes"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "gate_passes_tenant_id_number_key" ON "gate_passes"("tenant_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "proofs_of_delivery_delivery_id_key" ON "proofs_of_delivery"("delivery_id");

-- CreateIndex
CREATE INDEX "proofs_of_delivery_tenant_id_idx" ON "proofs_of_delivery"("tenant_id");

-- CreateIndex
CREATE INDEX "proof_lines_tenant_id_idx" ON "proof_lines"("tenant_id");

-- CreateIndex
CREATE INDEX "proof_lines_proof_id_idx" ON "proof_lines"("proof_id");

-- CreateIndex
CREATE INDEX "sales_returns_tenant_id_idx" ON "sales_returns"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_returns_tenant_id_number_key" ON "sales_returns"("tenant_id", "number");

-- CreateIndex
CREATE INDEX "sales_return_lines_tenant_id_idx" ON "sales_return_lines"("tenant_id");

-- CreateIndex
CREATE INDEX "sales_return_lines_return_id_idx" ON "sales_return_lines"("return_id");

-- CreateIndex
CREATE INDEX "order_cancellations_tenant_id_idx" ON "order_cancellations"("tenant_id");

-- CreateIndex
CREATE INDEX "order_cancellations_order_id_idx" ON "order_cancellations"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "sfa_api_keys_key_hash_key" ON "sfa_api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "sfa_api_keys_tenant_id_idx" ON "sfa_api_keys"("tenant_id");

-- CreateIndex
CREATE INDEX "sfa_messages_tenant_id_status_idx" ON "sfa_messages"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sfa_messages_tenant_id_direction_entity_external_ref_key" ON "sfa_messages"("tenant_id", "direction", "entity", "external_ref");

-- CreateIndex
CREATE UNIQUE INDEX "bank_file_templates_tenant_id_key" ON "bank_file_templates"("tenant_id");

-- CreateIndex
CREATE INDEX "bank_file_exports_tenant_id_idx" ON "bank_file_exports"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_file_exports_tenant_id_number_key" ON "bank_file_exports"("tenant_id", "number");

-- CreateIndex
CREATE INDEX "app_notifications_tenant_id_created_at_idx" ON "app_notifications"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenant_id_external_ref_key" ON "customers"("tenant_id", "external_ref");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_tenant_id_external_ref_key" ON "sales_invoices"("tenant_id", "external_ref");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_tenant_id_external_ref_key" ON "sales_orders"("tenant_id", "external_ref");

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_ship_to_id_fkey" FOREIGN KEY ("ship_to_id") REFERENCES "ship_tos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "delivery_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_settings" ADD CONSTRAINT "dispatch_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ship_tos" ADD CONSTRAINT "ship_tos_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ship_tos" ADD CONSTRAINT "ship_tos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_routes" ADD CONSTRAINT "delivery_routes_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_routes" ADD CONSTRAINT "delivery_routes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "delivery_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_prices" ADD CONSTRAINT "customer_prices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_prices" ADD CONSTRAINT "customer_prices_customer_category_id_fkey" FOREIGN KEY ("customer_category_id") REFERENCES "customer_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_prices" ADD CONSTRAINT "customer_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_prices" ADD CONSTRAINT "customer_prices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_reservations" ADD CONSTRAINT "sales_reservations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_reservations" ADD CONSTRAINT "sales_reservations_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "sales_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_reservations" ADD CONSTRAINT "sales_reservations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_picks" ADD CONSTRAINT "route_picks_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "delivery_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_picks" ADD CONSTRAINT "route_picks_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_picks" ADD CONSTRAINT "route_picks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_pick_lines" ADD CONSTRAINT "route_pick_lines_pick_id_fkey" FOREIGN KEY ("pick_id") REFERENCES "route_picks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_pick_lines" ADD CONSTRAINT "route_pick_lines_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "sales_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_pick_lines" ADD CONSTRAINT "route_pick_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_pick_lines" ADD CONSTRAINT "route_pick_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_pick_orders" ADD CONSTRAINT "route_pick_orders_pick_id_fkey" FOREIGN KEY ("pick_id") REFERENCES "route_picks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_pick_orders" ADD CONSTRAINT "route_pick_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_pick_orders" ADD CONSTRAINT "route_pick_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_sheets" ADD CONSTRAINT "trip_sheets_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "delivery_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_sheets" ADD CONSTRAINT "trip_sheets_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_sheets" ADD CONSTRAINT "trip_sheets_pick_id_fkey" FOREIGN KEY ("pick_id") REFERENCES "route_picks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_sheets" ADD CONSTRAINT "trip_sheets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_deliveries" ADD CONSTRAINT "trip_deliveries_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_deliveries" ADD CONSTRAINT "trip_deliveries_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "sales_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_deliveries" ADD CONSTRAINT "trip_deliveries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proofs_of_delivery" ADD CONSTRAINT "proofs_of_delivery_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "sales_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proofs_of_delivery" ADD CONSTRAINT "proofs_of_delivery_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trip_sheets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proofs_of_delivery" ADD CONSTRAINT "proofs_of_delivery_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_lines" ADD CONSTRAINT "proof_lines_proof_id_fkey" FOREIGN KEY ("proof_id") REFERENCES "proofs_of_delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_lines" ADD CONSTRAINT "proof_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_lines" ADD CONSTRAINT "proof_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "sales_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "sales_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_cancellations" ADD CONSTRAINT "order_cancellations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_cancellations" ADD CONSTRAINT "order_cancellations_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "sales_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_cancellations" ADD CONSTRAINT "order_cancellations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sfa_api_keys" ADD CONSTRAINT "sfa_api_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sfa_messages" ADD CONSTRAINT "sfa_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_file_templates" ADD CONSTRAINT "bank_file_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_file_exports" ADD CONSTRAINT "bank_file_exports_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "bank_file_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_file_exports" ADD CONSTRAINT "bank_file_exports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_notifications" ADD CONSTRAINT "app_notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

