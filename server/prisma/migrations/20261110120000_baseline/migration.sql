-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "role_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "credit_limit" DECIMAL(19,4) NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "active_status" TEXT DEFAULT 'ACTIVE',
    "branches" JSONB DEFAULT '[]',
    "credit_customer" BOOLEAN DEFAULT false,
    "credit_period" INTEGER DEFAULT 0,
    "customer_category" TEXT,
    "customer_segment" TEXT,
    "customer_type" TEXT,
    "industry" TEXT,
    "mobile_number" TEXT,
    "price_list" TEXT,
    "sales_rep" TEXT,
    "accounts_receivable_id" TEXT,
    "allow_credit_sales" BOOLEAN DEFAULT false,
    "customer_category_id" TEXT,
    "discount_group" TEXT,
    "revenue_account_id" TEXT,
    "sales_territory" TEXT,
    "tax_group" TEXT,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "active_status" TEXT DEFAULT 'ACTIVE',
    "supplier_category" TEXT,
    "lead_time" INTEGER DEFAULT 0,
    "currency" TEXT DEFAULT 'USD',
    "credit_supplier" BOOLEAN DEFAULT false,
    "credit_period" INTEGER DEFAULT 0,
    "payment_terms" TEXT,
    "supplier_group" TEXT,
    "branches" JSONB DEFAULT '[]',
    "bank_details" JSONB DEFAULT '[]',
    "accounts_payable_id" TEXT,
    "advance_payment_account_id" TEXT,
    "withholding_tax_group" TEXT,
    "tax_group" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_brands" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT,
    "parent_id" TEXT,

    CONSTRAINT "product_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_of_measures" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "unit_of_measures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "symbol" TEXT,
    "name" TEXT NOT NULL,
    "exchange_rate" DECIMAL(19,4) NOT NULL DEFAULT 1.0,
    "is_base" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cost_price" DECIMAL(19,4) NOT NULL DEFAULT 0.0,
    "selling_price" DECIMAL(19,4) NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "brand_id" TEXT,
    "category_id" TEXT,
    "type" TEXT NOT NULL DEFAULT 'PRODUCT',
    "uom_id" TEXT,
    "product_type_id" TEXT,
    "cpg" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "hs_code" TEXT,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "reorder_level" INTEGER NOT NULL DEFAULT 0,
    "sub_category_id" TEXT,
    "supplier_id" TEXT,
    "active_status" TEXT DEFAULT 'ACTIVE',
    "bom_applicable" BOOLEAN DEFAULT false,
    "cogs_account_id" TEXT,
    "conversion_factor" DECIMAL(19,4) DEFAULT 1.0,
    "costing_method" TEXT DEFAULT 'FIFO',
    "inventory_account_id" TEXT,
    "product_group" TEXT,
    "product_group_id" TEXT,
    "purchase_uom_id" TEXT,
    "safety_stock" INTEGER DEFAULT 0,
    "sales_uom_id" TEXT,
    "scrap_percent" DECIMAL(19,4) DEFAULT 0.0,
    "standard_cost" DECIMAL(19,4) DEFAULT 0.0,
    "stock_uom_id" TEXT,
    "tax_group" TEXT,
    "uom_conversions" JSONB DEFAULT '[]',
    "currency_id" TEXT,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "entry_number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "is_posted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" TEXT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "debit" DECIMAL(19,4) NOT NULL DEFAULT 0.0,
    "credit" DECIMAL(19,4) NOT NULL DEFAULT 0.0,
    "description" TEXT,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "warehouse_id" TEXT,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_quotations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "quotation_number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "total" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "currency_id" TEXT,
    "exchange_rate" DECIMAL(19,4) NOT NULL DEFAULT 1.0,

    CONSTRAINT "sales_quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_quotation_items" (
    "id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "total" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "sales_quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "quotation_id" TEXT,
    "order_number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "total" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "currency_id" TEXT,
    "exchange_rate" DECIMAL(19,4) NOT NULL DEFAULT 1.0,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "total" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_deliveries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "order_id" TEXT,
    "delivery_number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DELIVERED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "warehouse_id" TEXT,

    CONSTRAINT "sales_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_delivery_items" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "sales_delivery_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "order_id" TEXT,
    "invoice_number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "total" DECIMAL(19,4) NOT NULL,
    "amount_paid" DECIMAL(19,4) NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "delivery_id" TEXT,
    "currency_id" TEXT,
    "exchange_rate" DECIMAL(19,4) NOT NULL DEFAULT 1.0,

    CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "total" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "sales_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "po_number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "total" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "currency_id" TEXT,
    "exchange_rate" DECIMAL(19,4) NOT NULL DEFAULT 1.0,
    "pr_id" TEXT,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "total" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grns" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "po_id" TEXT,
    "grn_number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "warehouse_id" TEXT,
    "currency_id" TEXT,
    "exchange_rate" DECIMAL(19,4) NOT NULL DEFAULT 1.0,

    CONSTRAINT "grns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grn_items" (
    "id" TEXT NOT NULL,
    "grn_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity_received" DECIMAL(19,4) NOT NULL,
    "quantity_ordered" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "grn_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_issues" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "gi_number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "total" DECIMAL(19,4) NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "warehouse_id" TEXT,

    CONSTRAINT "goods_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_issue_items" (
    "id" TEXT NOT NULL,
    "gi_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "total" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "goods_issue_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "adj_number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "total" DECIMAL(19,4) NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "warehouse_id" TEXT,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustment_items" (
    "id" TEXT NOT NULL,
    "adj_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "system_qty" DECIMAL(19,4) NOT NULL,
    "actual_qty" DECIMAL(19,4) NOT NULL,
    "diff_qty" DECIMAL(19,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "total" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "stock_adjustment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_receipts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "invoice_id" TEXT,
    "receipt_number" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "account_id" TEXT,
    "bank_name" TEXT,
    "cheque_number" TEXT,

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_receipt_lines" (
    "id" TEXT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "invoice_id" TEXT,
    "amount" DECIMAL(19,4) NOT NULL,
    "description" TEXT,

    CONSTRAINT "payment_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_vouchers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "voucher_number" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "bank_name" TEXT,
    "cheque_number" TEXT,

    CONSTRAINT "payment_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_voucher_lines" (
    "id" TEXT NOT NULL,
    "voucher_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "description" TEXT,

    CONSTRAINT "payment_voucher_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "emp_code" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "department" TEXT,
    "designation" TEXT,
    "date_of_joining" TIMESTAMP(3) NOT NULL,
    "basic_salary" DECIMAL(19,4) NOT NULL DEFAULT 0.0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_additions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FIXED',
    "default_amount" DECIMAL(19,4) NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "hr_additions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_deductions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'STATUTORY',
    "default_amount" DECIMAL(19,4) NOT NULL DEFAULT 0.0,
    "is_statutory" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "hr_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "days_allowed" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_leave_balances" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "leave_type_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "used" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_applications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "leave_type_id" TEXT NOT NULL,
    "from_date" TIMESTAMP(3) NOT NULL,
    "to_date" TIMESTAMP(3) NOT NULL,
    "days" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "leave_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_loans" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "loan_number" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "outstanding" DECIMAL(19,4) NOT NULL,
    "tenure_months" INTEGER NOT NULL,
    "emi_amount" DECIMAL(19,4) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "employee_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_installments" (
    "id" TEXT NOT NULL,
    "loan_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paid_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_runs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "run_number" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "salary_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_run_lines" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "gross_earnings" DECIMAL(19,4) NOT NULL,
    "total_deductions" DECIMAL(19,4) NOT NULL,
    "net_pay" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "salary_run_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_run_additions" (
    "id" TEXT NOT NULL,
    "line_id" TEXT NOT NULL,
    "addition_id" TEXT,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "salary_run_additions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_run_deductions" (
    "id" TEXT NOT NULL,
    "line_id" TEXT NOT NULL,
    "deduction_id" TEXT,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'DEDUCTION',

    CONSTRAINT "salary_run_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_holidays" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'PUBLIC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "company_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_types" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "accounts_receivable_id" TEXT,
    "revenue_account_id" TEXT,
    "tax_group" TEXT,
    "credit_limit" DECIMAL(19,4) NOT NULL DEFAULT 0.0,
    "credit_period" INTEGER NOT NULL DEFAULT 0,
    "allow_credit_sales" BOOLEAN NOT NULL DEFAULT false,
    "price_list" TEXT,
    "discount_group" TEXT,
    "sales_territory" TEXT,
    "sales_rep" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "customer_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_lists" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "is_buying" BOOLEAN NOT NULL DEFAULT false,
    "is_selling" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list_prices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "price_list_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "price" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "price_list_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_groups" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "discount_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_group_products" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "discount_group_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "discount_type" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "discount_value" DECIMAL(19,4) NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "discount_group_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_groups" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "tax_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_slabs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tax_group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(19,4) NOT NULL,
    "calculation_type" TEXT NOT NULL DEFAULT 'ADDITIVE',
    "calculation_order" INTEGER NOT NULL DEFAULT 1,
    "account_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "tax_slabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_terms" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "payment_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_tax_groups" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "purchase_tax_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_tax_slabs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tax_group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(19,4) NOT NULL,
    "calculation_type" TEXT NOT NULL DEFAULT 'ADDITIVE',
    "calculation_order" INTEGER NOT NULL DEFAULT 1,
    "account_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "purchase_tax_slabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_withholding_tax_groups" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "purchase_withholding_tax_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_withholding_tax_slabs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tax_group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(19,4) NOT NULL,
    "calculation_type" TEXT NOT NULL DEFAULT 'ADDITIVE',
    "calculation_order" INTEGER NOT NULL DEFAULT 1,
    "account_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "purchase_withholding_tax_slabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requisitions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "pr_number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "total" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "currency_id" TEXT,
    "exchange_rate" DECIMAL(19,4) NOT NULL DEFAULT 1.0,

    CONSTRAINT "purchase_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requisition_items" (
    "id" TEXT NOT NULL,
    "pr_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "total" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "purchase_requisition_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_receipts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "total" DECIMAL(19,4) NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "warehouse_id" TEXT,

    CONSTRAINT "stock_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_receipt_items" (
    "id" TEXT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "total" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "stock_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transfer_number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "from_warehouse_id" TEXT,
    "to_warehouse_id" TEXT,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_items" (
    "id" TEXT NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "stock_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boms" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "routing_steps" JSONB DEFAULT '[]',
    "total_cost" DECIMAL(19,4) NOT NULL DEFAULT 0.0,
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "activated_at" TIMESTAMP(3),
    "activated_by" TEXT,

    CONSTRAINT "boms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "bom_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "scrap_percent" DECIMAL(19,4) NOT NULL DEFAULT 0.0,
    "instruction" TEXT,
    "type" TEXT NOT NULL DEFAULT 'Raw Material',

    CONSTRAINT "bom_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_resources" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "bom_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bom_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_patterns" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "work_days" JSONB DEFAULT '[]',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "shift_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_calendar_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "shift_pattern_id" TEXT,
    "work_center_id" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "production_calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_jobs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "job_number" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "bom_id" TEXT,
    "quantity" DECIMAL(19,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "assigned_to" TEXT,
    "work_center_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "production_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "bom_id" TEXT,
    "quantity" DECIMAL(19,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "assigned_to" TEXT,
    "work_center_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workstations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "hourly_rate" DECIMAL(19,4) NOT NULL DEFAULT 0.0,
    "efficiency" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "workstations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "workstation_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pos_x" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "pos_y" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 176,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 72,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_reconciliations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "statement_closing_balance" DECIMAL(19,4) NOT NULL,
    "ledger_closing_balance" DECIMAL(19,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reconciled_at" TIMESTAMP(3),
    "reconciled_by" TEXT,
    "approved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "bank_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statement_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "bank_reconciliation_id" TEXT,
    "account_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "cheque_number" TEXT,
    "description" TEXT,
    "amount" DECIMAL(19,4) NOT NULL,
    "is_matched" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_statement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_reconciliation_matches" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "reconciliation_id" TEXT NOT NULL,
    "statement_line_id" TEXT NOT NULL,
    "journal_line_id" TEXT NOT NULL,
    "match_type" TEXT NOT NULL DEFAULT 'MANUAL',
    "confidence_score" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_reconciliation_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_groups" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,

    CONSTRAINT "product_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "roles_tenant_id_idx" ON "roles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenant_id_name_key" ON "roles"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "user_preferences_tenant_id_idx" ON "user_preferences"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_key_key" ON "user_preferences"("user_id", "key");

-- CreateIndex
CREATE INDEX "customers_tenant_id_idx" ON "customers"("tenant_id");

-- CreateIndex
CREATE INDEX "suppliers_tenant_id_idx" ON "suppliers"("tenant_id");

-- CreateIndex
CREATE INDEX "product_categories_tenant_id_idx" ON "product_categories"("tenant_id");

-- CreateIndex
CREATE INDEX "product_brands_tenant_id_idx" ON "product_brands"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "unit_of_measures_tenant_id_name_key" ON "unit_of_measures"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "currencies_tenant_id_idx" ON "currencies"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_tenant_id_code_key" ON "currencies"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "products_tenant_id_idx" ON "products"("tenant_id");

-- CreateIndex
CREATE INDEX "accounts_tenant_id_idx" ON "accounts"("tenant_id");

-- CreateIndex
CREATE INDEX "journal_entries_tenant_id_idx" ON "journal_entries"("tenant_id");

-- CreateIndex
CREATE INDEX "journal_lines_journal_entry_id_idx" ON "journal_lines"("journal_entry_id");

-- CreateIndex
CREATE INDEX "journal_lines_account_id_idx" ON "journal_lines"("account_id");

-- CreateIndex
CREATE INDEX "stock_movements_tenant_id_idx" ON "stock_movements"("tenant_id");

-- CreateIndex
CREATE INDEX "stock_movements_product_id_idx" ON "stock_movements"("product_id");

-- CreateIndex
CREATE INDEX "sales_quotations_tenant_id_idx" ON "sales_quotations"("tenant_id");

-- CreateIndex
CREATE INDEX "sales_quotation_items_quotation_id_idx" ON "sales_quotation_items"("quotation_id");

-- CreateIndex
CREATE INDEX "sales_quotation_items_product_id_idx" ON "sales_quotation_items"("product_id");

-- CreateIndex
CREATE INDEX "sales_orders_tenant_id_idx" ON "sales_orders"("tenant_id");

-- CreateIndex
CREATE INDEX "sales_order_items_order_id_idx" ON "sales_order_items"("order_id");

-- CreateIndex
CREATE INDEX "sales_order_items_product_id_idx" ON "sales_order_items"("product_id");

-- CreateIndex
CREATE INDEX "sales_deliveries_tenant_id_idx" ON "sales_deliveries"("tenant_id");

-- CreateIndex
CREATE INDEX "sales_delivery_items_delivery_id_idx" ON "sales_delivery_items"("delivery_id");

-- CreateIndex
CREATE INDEX "sales_delivery_items_product_id_idx" ON "sales_delivery_items"("product_id");

-- CreateIndex
CREATE INDEX "sales_invoices_tenant_id_idx" ON "sales_invoices"("tenant_id");

-- CreateIndex
CREATE INDEX "sales_invoice_items_invoice_id_idx" ON "sales_invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "sales_invoice_items_product_id_idx" ON "sales_invoice_items"("product_id");

-- CreateIndex
CREATE INDEX "purchase_orders_tenant_id_idx" ON "purchase_orders"("tenant_id");

-- CreateIndex
CREATE INDEX "purchase_order_items_po_id_idx" ON "purchase_order_items"("po_id");

-- CreateIndex
CREATE INDEX "purchase_order_items_product_id_idx" ON "purchase_order_items"("product_id");

-- CreateIndex
CREATE INDEX "grns_tenant_id_idx" ON "grns"("tenant_id");

-- CreateIndex
CREATE INDEX "grn_items_grn_id_idx" ON "grn_items"("grn_id");

-- CreateIndex
CREATE INDEX "grn_items_product_id_idx" ON "grn_items"("product_id");

-- CreateIndex
CREATE INDEX "goods_issues_tenant_id_idx" ON "goods_issues"("tenant_id");

-- CreateIndex
CREATE INDEX "goods_issue_items_gi_id_idx" ON "goods_issue_items"("gi_id");

-- CreateIndex
CREATE INDEX "goods_issue_items_product_id_idx" ON "goods_issue_items"("product_id");

-- CreateIndex
CREATE INDEX "stock_adjustments_tenant_id_idx" ON "stock_adjustments"("tenant_id");

-- CreateIndex
CREATE INDEX "stock_adjustment_items_adj_id_idx" ON "stock_adjustment_items"("adj_id");

-- CreateIndex
CREATE INDEX "stock_adjustment_items_product_id_idx" ON "stock_adjustment_items"("product_id");

-- CreateIndex
CREATE INDEX "payment_receipts_tenant_id_idx" ON "payment_receipts"("tenant_id");

-- CreateIndex
CREATE INDEX "payment_receipt_lines_receipt_id_idx" ON "payment_receipt_lines"("receipt_id");

-- CreateIndex
CREATE INDEX "payment_receipt_lines_account_id_idx" ON "payment_receipt_lines"("account_id");

-- CreateIndex
CREATE INDEX "payment_vouchers_tenant_id_idx" ON "payment_vouchers"("tenant_id");

-- CreateIndex
CREATE INDEX "payment_voucher_lines_voucher_id_idx" ON "payment_voucher_lines"("voucher_id");

-- CreateIndex
CREATE INDEX "payment_voucher_lines_account_id_idx" ON "payment_voucher_lines"("account_id");

-- CreateIndex
CREATE INDEX "warehouses_tenant_id_idx" ON "warehouses"("tenant_id");

-- CreateIndex
CREATE INDEX "employees_tenant_id_idx" ON "employees"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_tenant_id_emp_code_key" ON "employees"("tenant_id", "emp_code");

-- CreateIndex
CREATE INDEX "hr_additions_tenant_id_idx" ON "hr_additions"("tenant_id");

-- CreateIndex
CREATE INDEX "hr_deductions_tenant_id_idx" ON "hr_deductions"("tenant_id");

-- CreateIndex
CREATE INDEX "leave_types_tenant_id_idx" ON "leave_types"("tenant_id");

-- CreateIndex
CREATE INDEX "employee_leave_balances_employee_id_idx" ON "employee_leave_balances"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_leave_balances_employee_id_leave_type_id_year_key" ON "employee_leave_balances"("employee_id", "leave_type_id", "year");

-- CreateIndex
CREATE INDEX "leave_applications_tenant_id_idx" ON "leave_applications"("tenant_id");

-- CreateIndex
CREATE INDEX "leave_applications_employee_id_idx" ON "leave_applications"("employee_id");

-- CreateIndex
CREATE INDEX "employee_loans_tenant_id_idx" ON "employee_loans"("tenant_id");

-- CreateIndex
CREATE INDEX "employee_loans_employee_id_idx" ON "employee_loans"("employee_id");

-- CreateIndex
CREATE INDEX "loan_installments_loan_id_idx" ON "loan_installments"("loan_id");

-- CreateIndex
CREATE INDEX "salary_runs_tenant_id_idx" ON "salary_runs"("tenant_id");

-- CreateIndex
CREATE INDEX "salary_run_lines_run_id_idx" ON "salary_run_lines"("run_id");

-- CreateIndex
CREATE INDEX "salary_run_lines_employee_id_idx" ON "salary_run_lines"("employee_id");

-- CreateIndex
CREATE INDEX "salary_run_additions_line_id_idx" ON "salary_run_additions"("line_id");

-- CreateIndex
CREATE INDEX "salary_run_deductions_line_id_idx" ON "salary_run_deductions"("line_id");

-- CreateIndex
CREATE INDEX "company_holidays_tenant_id_idx" ON "company_holidays"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_types_tenant_id_name_key" ON "product_types"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "customer_categories_tenant_id_idx" ON "customer_categories"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_categories_tenant_id_code_key" ON "customer_categories"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "price_lists_tenant_id_idx" ON "price_lists"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "price_lists_tenant_id_name_key" ON "price_lists"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "price_list_prices_tenant_id_idx" ON "price_list_prices"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "price_list_prices_tenant_id_price_list_id_product_id_key" ON "price_list_prices"("tenant_id", "price_list_id", "product_id");

-- CreateIndex
CREATE INDEX "discount_groups_tenant_id_idx" ON "discount_groups"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "discount_groups_tenant_id_name_key" ON "discount_groups"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "discount_group_products_tenant_id_idx" ON "discount_group_products"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "discount_group_products_tenant_id_discount_group_id_product_key" ON "discount_group_products"("tenant_id", "discount_group_id", "product_id");

-- CreateIndex
CREATE INDEX "tax_groups_tenant_id_idx" ON "tax_groups"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_groups_tenant_id_name_key" ON "tax_groups"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "tax_slabs_tenant_id_idx" ON "tax_slabs"("tenant_id");

-- CreateIndex
CREATE INDEX "tax_slabs_tax_group_id_idx" ON "tax_slabs"("tax_group_id");

-- CreateIndex
CREATE INDEX "payment_terms_tenant_id_idx" ON "payment_terms"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_terms_tenant_id_code_key" ON "payment_terms"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "purchase_tax_groups_tenant_id_idx" ON "purchase_tax_groups"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_tax_groups_tenant_id_name_key" ON "purchase_tax_groups"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "purchase_tax_slabs_tenant_id_idx" ON "purchase_tax_slabs"("tenant_id");

-- CreateIndex
CREATE INDEX "purchase_tax_slabs_tax_group_id_idx" ON "purchase_tax_slabs"("tax_group_id");

-- CreateIndex
CREATE INDEX "purchase_withholding_tax_groups_tenant_id_idx" ON "purchase_withholding_tax_groups"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_withholding_tax_groups_tenant_id_name_key" ON "purchase_withholding_tax_groups"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "purchase_withholding_tax_slabs_tenant_id_idx" ON "purchase_withholding_tax_slabs"("tenant_id");

-- CreateIndex
CREATE INDEX "purchase_withholding_tax_slabs_tax_group_id_idx" ON "purchase_withholding_tax_slabs"("tax_group_id");

-- CreateIndex
CREATE INDEX "purchase_requisitions_tenant_id_idx" ON "purchase_requisitions"("tenant_id");

-- CreateIndex
CREATE INDEX "purchase_requisition_items_pr_id_idx" ON "purchase_requisition_items"("pr_id");

-- CreateIndex
CREATE INDEX "purchase_requisition_items_product_id_idx" ON "purchase_requisition_items"("product_id");

-- CreateIndex
CREATE INDEX "stock_receipts_tenant_id_idx" ON "stock_receipts"("tenant_id");

-- CreateIndex
CREATE INDEX "stock_receipt_items_receipt_id_idx" ON "stock_receipt_items"("receipt_id");

-- CreateIndex
CREATE INDEX "stock_receipt_items_product_id_idx" ON "stock_receipt_items"("product_id");

-- CreateIndex
CREATE INDEX "stock_transfers_tenant_id_idx" ON "stock_transfers"("tenant_id");

-- CreateIndex
CREATE INDEX "stock_transfer_items_transfer_id_idx" ON "stock_transfer_items"("transfer_id");

-- CreateIndex
CREATE INDEX "stock_transfer_items_product_id_idx" ON "stock_transfer_items"("product_id");

-- CreateIndex
CREATE INDEX "boms_tenant_id_idx" ON "boms"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "boms_tenant_id_product_id_code_key" ON "boms"("tenant_id", "product_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "boms_tenant_id_product_id_version_key" ON "boms"("tenant_id", "product_id", "version");

-- CreateIndex
CREATE INDEX "bom_items_tenant_id_idx" ON "bom_items"("tenant_id");

-- CreateIndex
CREATE INDEX "bom_resources_tenant_id_idx" ON "bom_resources"("tenant_id");

-- CreateIndex
CREATE INDEX "bom_resources_bom_id_idx" ON "bom_resources"("bom_id");

-- CreateIndex
CREATE UNIQUE INDEX "shift_patterns_tenant_id_name_key" ON "shift_patterns"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "production_calendar_events_tenant_id_idx" ON "production_calendar_events"("tenant_id");

-- CreateIndex
CREATE INDEX "production_jobs_tenant_id_idx" ON "production_jobs"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_jobs_tenant_id_job_number_key" ON "production_jobs"("tenant_id", "job_number");

-- CreateIndex
CREATE INDEX "production_orders_tenant_id_idx" ON "production_orders"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_tenant_id_order_number_key" ON "production_orders"("tenant_id", "order_number");

-- CreateIndex
CREATE INDEX "workstations_tenant_id_idx" ON "workstations"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "workstations_tenant_id_code_key" ON "workstations"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "machines_tenant_id_idx" ON "machines"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "machines_tenant_id_code_key" ON "machines"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "bank_reconciliations_tenant_id_idx" ON "bank_reconciliations"("tenant_id");

-- CreateIndex
CREATE INDEX "bank_reconciliations_account_id_idx" ON "bank_reconciliations"("account_id");

-- CreateIndex
CREATE INDEX "bank_statement_lines_tenant_id_idx" ON "bank_statement_lines"("tenant_id");

-- CreateIndex
CREATE INDEX "bank_statement_lines_account_id_idx" ON "bank_statement_lines"("account_id");

-- CreateIndex
CREATE INDEX "bank_statement_lines_bank_reconciliation_id_idx" ON "bank_statement_lines"("bank_reconciliation_id");

-- CreateIndex
CREATE INDEX "bank_reconciliation_matches_tenant_id_idx" ON "bank_reconciliation_matches"("tenant_id");

-- CreateIndex
CREATE INDEX "bank_reconciliation_matches_reconciliation_id_idx" ON "bank_reconciliation_matches"("reconciliation_id");

-- CreateIndex
CREATE INDEX "bank_reconciliation_matches_statement_line_id_idx" ON "bank_reconciliation_matches"("statement_line_id");

-- CreateIndex
CREATE INDEX "bank_reconciliation_matches_journal_line_id_idx" ON "bank_reconciliation_matches"("journal_line_id");

-- CreateIndex
CREATE INDEX "product_groups_tenant_id_idx" ON "product_groups"("tenant_id");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_accounts_receivable_id_fkey" FOREIGN KEY ("accounts_receivable_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_customer_category_id_fkey" FOREIGN KEY ("customer_category_id") REFERENCES "customer_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_revenue_account_id_fkey" FOREIGN KEY ("revenue_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_accounts_payable_id_fkey" FOREIGN KEY ("accounts_payable_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_advance_payment_account_id_fkey" FOREIGN KEY ("advance_payment_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_brands" ADD CONSTRAINT "product_brands_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "currencies" ADD CONSTRAINT "currencies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "product_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_product_group_id_fkey" FOREIGN KEY ("product_group_id") REFERENCES "product_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_cogs_account_id_fkey" FOREIGN KEY ("cogs_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_inventory_account_id_fkey" FOREIGN KEY ("inventory_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_product_type_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_purchase_uom_id_fkey" FOREIGN KEY ("purchase_uom_id") REFERENCES "unit_of_measures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_sales_uom_id_fkey" FOREIGN KEY ("sales_uom_id") REFERENCES "unit_of_measures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_stock_uom_id_fkey" FOREIGN KEY ("stock_uom_id") REFERENCES "unit_of_measures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "unit_of_measures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotations" ADD CONSTRAINT "sales_quotations_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotations" ADD CONSTRAINT "sales_quotations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotations" ADD CONSTRAINT "sales_quotations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotation_items" ADD CONSTRAINT "sales_quotation_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotation_items" ADD CONSTRAINT "sales_quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "sales_quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "sales_quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_delivery_items" ADD CONSTRAINT "sales_delivery_items_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "sales_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_delivery_items" ADD CONSTRAINT "sales_delivery_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "sales_deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_pr_id_fkey" FOREIGN KEY ("pr_id") REFERENCES "purchase_requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grns" ADD CONSTRAINT "grns_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grns" ADD CONSTRAINT "grns_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grns" ADD CONSTRAINT "grns_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grns" ADD CONSTRAINT "grns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grns" ADD CONSTRAINT "grns_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_items" ADD CONSTRAINT "grn_items_grn_id_fkey" FOREIGN KEY ("grn_id") REFERENCES "grns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grn_items" ADD CONSTRAINT "grn_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_issues" ADD CONSTRAINT "goods_issues_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_issues" ADD CONSTRAINT "goods_issues_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_issues" ADD CONSTRAINT "goods_issues_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_issue_items" ADD CONSTRAINT "goods_issue_items_gi_id_fkey" FOREIGN KEY ("gi_id") REFERENCES "goods_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_issue_items" ADD CONSTRAINT "goods_issue_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_adj_id_fkey" FOREIGN KEY ("adj_id") REFERENCES "stock_adjustments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipt_lines" ADD CONSTRAINT "payment_receipt_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipt_lines" ADD CONSTRAINT "payment_receipt_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipt_lines" ADD CONSTRAINT "payment_receipt_lines_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "payment_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_voucher_lines" ADD CONSTRAINT "payment_voucher_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_voucher_lines" ADD CONSTRAINT "payment_voucher_lines_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "payment_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_additions" ADD CONSTRAINT "hr_additions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_deductions" ADD CONSTRAINT "hr_deductions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_leave_balances" ADD CONSTRAINT "employee_leave_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_leave_balances" ADD CONSTRAINT "employee_leave_balances_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_applications" ADD CONSTRAINT "leave_applications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_applications" ADD CONSTRAINT "leave_applications_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_applications" ADD CONSTRAINT "leave_applications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_installments" ADD CONSTRAINT "loan_installments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "employee_loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_runs" ADD CONSTRAINT "salary_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_run_lines" ADD CONSTRAINT "salary_run_lines_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_run_lines" ADD CONSTRAINT "salary_run_lines_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "salary_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_run_additions" ADD CONSTRAINT "salary_run_additions_addition_id_fkey" FOREIGN KEY ("addition_id") REFERENCES "hr_additions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_run_additions" ADD CONSTRAINT "salary_run_additions_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "salary_run_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_run_deductions" ADD CONSTRAINT "salary_run_deductions_deduction_id_fkey" FOREIGN KEY ("deduction_id") REFERENCES "hr_deductions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_run_deductions" ADD CONSTRAINT "salary_run_deductions_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "salary_run_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_holidays" ADD CONSTRAINT "company_holidays_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_types" ADD CONSTRAINT "product_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_categories" ADD CONSTRAINT "customer_categories_accounts_receivable_id_fkey" FOREIGN KEY ("accounts_receivable_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_categories" ADD CONSTRAINT "customer_categories_revenue_account_id_fkey" FOREIGN KEY ("revenue_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_categories" ADD CONSTRAINT "customer_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_prices" ADD CONSTRAINT "price_list_prices_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_prices" ADD CONSTRAINT "price_list_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_prices" ADD CONSTRAINT "price_list_prices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_groups" ADD CONSTRAINT "discount_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_group_products" ADD CONSTRAINT "discount_group_products_discount_group_id_fkey" FOREIGN KEY ("discount_group_id") REFERENCES "discount_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_group_products" ADD CONSTRAINT "discount_group_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_group_products" ADD CONSTRAINT "discount_group_products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_groups" ADD CONSTRAINT "tax_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_slabs" ADD CONSTRAINT "tax_slabs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_slabs" ADD CONSTRAINT "tax_slabs_tax_group_id_fkey" FOREIGN KEY ("tax_group_id") REFERENCES "tax_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_slabs" ADD CONSTRAINT "tax_slabs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_terms" ADD CONSTRAINT "payment_terms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_tax_groups" ADD CONSTRAINT "purchase_tax_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_tax_slabs" ADD CONSTRAINT "purchase_tax_slabs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_tax_slabs" ADD CONSTRAINT "purchase_tax_slabs_tax_group_id_fkey" FOREIGN KEY ("tax_group_id") REFERENCES "purchase_tax_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_tax_slabs" ADD CONSTRAINT "purchase_tax_slabs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_withholding_tax_groups" ADD CONSTRAINT "purchase_withholding_tax_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_withholding_tax_slabs" ADD CONSTRAINT "purchase_withholding_tax_slabs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_withholding_tax_slabs" ADD CONSTRAINT "purchase_withholding_tax_slabs_tax_group_id_fkey" FOREIGN KEY ("tax_group_id") REFERENCES "purchase_withholding_tax_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_withholding_tax_slabs" ADD CONSTRAINT "purchase_withholding_tax_slabs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisition_items" ADD CONSTRAINT "purchase_requisition_items_pr_id_fkey" FOREIGN KEY ("pr_id") REFERENCES "purchase_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisition_items" ADD CONSTRAINT "purchase_requisition_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "stock_receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "stock_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "stock_receipt_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_warehouse_id_fkey" FOREIGN KEY ("from_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_warehouse_id_fkey" FOREIGN KEY ("to_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "boms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_resources" ADD CONSTRAINT "bom_resources_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "boms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_patterns" ADD CONSTRAINT "shift_patterns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_calendar_events" ADD CONSTRAINT "production_calendar_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_calendar_events" ADD CONSTRAINT "production_calendar_events_shift_pattern_id_fkey" FOREIGN KEY ("shift_pattern_id") REFERENCES "shift_patterns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "boms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "boms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workstations" ADD CONSTRAINT "workstations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_workstation_id_fkey" FOREIGN KEY ("workstation_id") REFERENCES "workstations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_bank_reconciliation_id_fkey" FOREIGN KEY ("bank_reconciliation_id") REFERENCES "bank_reconciliations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliation_matches" ADD CONSTRAINT "bank_reconciliation_matches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliation_matches" ADD CONSTRAINT "bank_reconciliation_matches_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "bank_reconciliations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliation_matches" ADD CONSTRAINT "bank_reconciliation_matches_statement_line_id_fkey" FOREIGN KEY ("statement_line_id") REFERENCES "bank_statement_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliation_matches" ADD CONSTRAINT "bank_reconciliation_matches_journal_line_id_fkey" FOREIGN KEY ("journal_line_id") REFERENCES "journal_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_groups" ADD CONSTRAINT "product_groups_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_groups" ADD CONSTRAINT "product_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

