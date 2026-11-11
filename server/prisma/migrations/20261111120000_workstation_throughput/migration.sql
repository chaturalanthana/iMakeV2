DROP TABLE IF EXISTS "workstation_throughputs";

CREATE TABLE "machine_throughputs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "machine_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "max_throughput" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "idle_throughput" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machine_throughputs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "machine_throughputs_machine_id_product_id_key" ON "machine_throughputs"("machine_id", "product_id");
CREATE INDEX "machine_throughputs_tenant_id_idx" ON "machine_throughputs"("tenant_id");

ALTER TABLE "machine_throughputs" ADD CONSTRAINT "machine_throughputs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "machine_throughputs" ADD CONSTRAINT "machine_throughputs_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "machine_throughputs" ADD CONSTRAINT "machine_throughputs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
