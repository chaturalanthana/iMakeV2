-- Phase 0 go-live controls: approvals, audit, fiscal periods, negative-stock setting.

ALTER TABLE "journal_entries" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'POSTED';

ALTER TABLE "operations_settings" ADD COLUMN "allow_negative_stock" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "approval_rules" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "allow_self_approve" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "approval_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_levels" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "threshold" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "approver_role_id" TEXT,
    "approver_user_id" TEXT,
    "delegate_user_id" TEXT,
    "escalate_after_hours" INTEGER,
    CONSTRAINT "approval_levels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL DEFAULT '',
    "amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "current_level" INTEGER NOT NULL DEFAULT 1,
    "requested_by" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_actions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "action" TEXT NOT NULL,
    "actor_id" TEXT,
    "reason" TEXT,
    "delegated_from_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_actions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fiscal_periods" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "approval_rules_tenant_id_document_type_key" ON "approval_rules"("tenant_id", "document_type");
CREATE INDEX "approval_rules_tenant_id_idx" ON "approval_rules"("tenant_id");
CREATE UNIQUE INDEX "approval_levels_rule_id_sequence_key" ON "approval_levels"("rule_id", "sequence");
CREATE INDEX "approval_levels_tenant_id_idx" ON "approval_levels"("tenant_id");
CREATE INDEX "approval_requests_tenant_id_status_idx" ON "approval_requests"("tenant_id", "status");
CREATE INDEX "approval_requests_tenant_id_document_type_document_id_idx" ON "approval_requests"("tenant_id", "document_type", "document_id");
CREATE INDEX "approval_actions_tenant_id_idx" ON "approval_actions"("tenant_id");
CREATE INDEX "approval_actions_request_id_idx" ON "approval_actions"("request_id");
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");
CREATE INDEX "audit_logs_tenant_id_entity_entity_id_idx" ON "audit_logs"("tenant_id", "entity", "entity_id");
CREATE UNIQUE INDEX "fiscal_periods_tenant_id_year_month_key" ON "fiscal_periods"("tenant_id", "year", "month");
CREATE INDEX "fiscal_periods_tenant_id_idx" ON "fiscal_periods"("tenant_id");

ALTER TABLE "approval_rules" ADD CONSTRAINT "approval_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_levels" ADD CONSTRAINT "approval_levels_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "approval_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
