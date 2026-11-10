-- FIFO cost layers, supplier invoices, and the default GL map.

ALTER TABLE "tenants" ALTER COLUMN "currency" SET DEFAULT 'LKR';
ALTER TABLE "products" ALTER COLUMN "currency" SET DEFAULT 'LKR';
ALTER TABLE "suppliers" ALTER COLUMN "currency" SET DEFAULT 'LKR';

ALTER TABLE "stock_movements" ADD COLUMN "unit_cost" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "stock_movements" ADD COLUMN "value" DECIMAL(19,4) NOT NULL DEFAULT 0;

ALTER TABLE "sales_delivery_items" ADD COLUMN "unit_cost" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "sales_delivery_items" ADD COLUMN "cost_value" DECIMAL(19,4) NOT NULL DEFAULT 0;

ALTER TABLE "sales_invoices" ADD COLUMN "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "sales_invoices" ADD COLUMN "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "sales_invoices" ADD COLUMN "due_date" TIMESTAMP(3);

ALTER TABLE "grn_items" ADD COLUMN "unit_price" DECIMAL(19,4) NOT NULL DEFAULT 0;

ALTER TABLE "payment_receipts" ADD COLUMN "exchange_rate" DECIMAL(19,4) NOT NULL DEFAULT 1;
ALTER TABLE "payment_receipts" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'POSTED';

ALTER TABLE "payment_vouchers" ADD COLUMN "account_id" TEXT;
ALTER TABLE "payment_vouchers" ADD COLUMN "exchange_rate" DECIMAL(19,4) NOT NULL DEFAULT 1;
ALTER TABLE "payment_vouchers" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'POSTED';

-- Same shape as production work orders (migration 20261110193000).
-- IF NOT EXISTS lets that migration's CREATE TABLE no-op if this one ran first.
-- When rebasing production onto this branch, change its cost_layers CREATE to IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS public.cost_layers (
    id text NOT NULL,
    tenant_id text NOT NULL,
    product_id text NOT NULL,
    warehouse_id text,
    quantity_received numeric(19,4) NOT NULL,
    quantity_remaining numeric(19,4) NOT NULL,
    unit_cost numeric(19,4) NOT NULL,
    source_type text NOT NULL,
    source_id text,
    received_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "gl_account_maps" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gl_account_maps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_invoices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "po_id" TEXT,
    "grn_id" TEXT,
    "invoice_number" TEXT NOT NULL,
    "supplier_reference" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "currency_id" TEXT,
    "exchange_rate" DECIMAL(19,4) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "wht_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(19,4) NOT NULL,
    "amount_paid" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "supplier_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_invoice_items" (
    "id" TEXT NOT NULL,
    "supplier_invoice_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "po_unit_price" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "supplier_invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_payment_allocations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "voucher_id" TEXT NOT NULL,
    "supplier_invoice_id" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "supplier_payment_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cost_layers_tenant_id_idx" ON public.cost_layers ("tenant_id");
CREATE INDEX IF NOT EXISTS "cost_layers_product_id_idx" ON public.cost_layers ("product_id");
CREATE INDEX IF NOT EXISTS "cost_layers_received_at_idx" ON public.cost_layers ("received_at");
CREATE UNIQUE INDEX "gl_account_maps_tenant_id_key_key" ON "gl_account_maps"("tenant_id", "key");
CREATE INDEX "gl_account_maps_tenant_id_idx" ON "gl_account_maps"("tenant_id");
CREATE INDEX "supplier_invoices_tenant_id_idx" ON "supplier_invoices"("tenant_id");
CREATE INDEX "supplier_invoices_supplier_id_idx" ON "supplier_invoices"("supplier_id");
CREATE INDEX "supplier_invoice_items_supplier_invoice_id_idx" ON "supplier_invoice_items"("supplier_invoice_id");
CREATE INDEX "supplier_invoice_items_product_id_idx" ON "supplier_invoice_items"("product_id");
CREATE INDEX "supplier_payment_allocations_tenant_id_idx" ON "supplier_payment_allocations"("tenant_id");
CREATE INDEX "supplier_payment_allocations_voucher_id_idx" ON "supplier_payment_allocations"("voucher_id");
CREATE INDEX "supplier_payment_allocations_supplier_invoice_id_idx" ON "supplier_payment_allocations"("supplier_invoice_id");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cost_layers_pkey') THEN
    ALTER TABLE public.cost_layers ADD CONSTRAINT cost_layers_pkey PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cost_layers_tenant_id_fkey') THEN
    ALTER TABLE public.cost_layers ADD CONSTRAINT cost_layers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cost_layers_product_id_fkey') THEN
    ALTER TABLE public.cost_layers ADD CONSTRAINT cost_layers_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE "gl_account_maps" ADD CONSTRAINT "gl_account_maps_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gl_account_maps" ADD CONSTRAINT "gl_account_maps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_grn_id_fkey" FOREIGN KEY ("grn_id") REFERENCES "grns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_invoice_items" ADD CONSTRAINT "supplier_invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_invoice_items" ADD CONSTRAINT "supplier_invoice_items_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_payment_allocations_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_payment_allocations_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "payment_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_payment_allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
