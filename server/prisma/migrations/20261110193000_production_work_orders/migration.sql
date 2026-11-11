-- Additive shop-floor migration. Apply after the baseline schema.
-- Copies nothing by itself; the API copies legacy jobs and production orders onto work orders.
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "lot_number" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "serial_number" TEXT;

CREATE TABLE public.cost_layers (
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


--
-- Name: material_reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_reservations (
    id text NOT NULL,
    tenant_id text NOT NULL,
    work_order_id text NOT NULL,
    component_id text NOT NULL,
    product_id text NOT NULL,
    warehouse_id text,
    quantity numeric(19,4) NOT NULL,
    consumed_qty numeric(19,4) DEFAULT 0 NOT NULL,
    status text DEFAULT 'OPEN'::text NOT NULL,
    lot_number text,
    serial_number text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: operation_time_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operation_time_logs (
    id text NOT NULL,
    tenant_id text NOT NULL,
    operation_id text NOT NULL,
    action text NOT NULL,
    at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    elapsed_minutes numeric(19,4) DEFAULT 0 NOT NULL,
    operator_name text
);


--
-- Name: production_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_settings (
    id text NOT NULL,
    tenant_id text NOT NULL,
    material_check text DEFAULT 'WARN'::text NOT NULL,
    issue_mode text DEFAULT 'BACKFLUSH'::text NOT NULL,
    overhead_percent numeric(19,4) DEFAULT 10 NOT NULL,
    labour_rate_per_hour numeric(19,4) DEFAULT 0 NOT NULL,
    hours_per_day numeric(19,4) DEFAULT 8 NOT NULL,
    work_days jsonb DEFAULT '[1, 2, 3, 4, 5]'::jsonb NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: reason_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reason_codes (
    id text NOT NULL,
    tenant_id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: routing_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.routing_operations (
    id text NOT NULL,
    tenant_id text NOT NULL,
    routing_id text NOT NULL,
    sequence integer NOT NULL,
    name text NOT NULL,
    workstation_id text,
    setup_minutes numeric(19,4) DEFAULT 0 NOT NULL,
    run_minutes_per_unit numeric(19,4) DEFAULT 0 NOT NULL,
    no_of_workers integer DEFAULT 1 NOT NULL,
    is_subcontract boolean DEFAULT false NOT NULL,
    subcontract_cost_per_unit numeric(19,4) DEFAULT 0 NOT NULL,
    instructions text
);


--
-- Name: routings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.routings (
    id text NOT NULL,
    tenant_id text NOT NULL,
    bom_id text NOT NULL,
    code text NOT NULL,
    version text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: work_order_components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_order_components (
    id text NOT NULL,
    tenant_id text NOT NULL,
    work_order_id text NOT NULL,
    product_id text NOT NULL,
    quantity_per numeric(19,4) NOT NULL,
    scrap_percent numeric(19,4) DEFAULT 0 NOT NULL,
    required_qty numeric(19,4) DEFAULT 0 NOT NULL,
    reserved_qty numeric(19,4) DEFAULT 0 NOT NULL,
    issued_qty numeric(19,4) DEFAULT 0 NOT NULL,
    unit_cost numeric(19,4) DEFAULT 0 NOT NULL,
    cost_source text DEFAULT 'COST_PRICE'::text NOT NULL,
    type text DEFAULT 'Raw Material'::text NOT NULL,
    instruction text
);


--
-- Name: work_order_confirmations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_order_confirmations (
    id text NOT NULL,
    tenant_id text NOT NULL,
    work_order_id text NOT NULL,
    operation_id text NOT NULL,
    yield_qty numeric(19,4) DEFAULT 0 NOT NULL,
    scrap_qty numeric(19,4) DEFAULT 0 NOT NULL,
    rework_qty numeric(19,4) DEFAULT 0 NOT NULL,
    scrap_reason_id text,
    rework_reason_id text,
    labour_minutes numeric(19,4) DEFAULT 0 NOT NULL,
    machine_minutes numeric(19,4) DEFAULT 0 NOT NULL,
    labour_cost numeric(19,4) DEFAULT 0 NOT NULL,
    machine_cost numeric(19,4) DEFAULT 0 NOT NULL,
    subcontract_cost numeric(19,4) DEFAULT 0 NOT NULL,
    overhead_cost numeric(19,4) DEFAULT 0 NOT NULL,
    material_cost numeric(19,4) DEFAULT 0 NOT NULL,
    scrap_cost numeric(19,4) DEFAULT 0 NOT NULL,
    lot_number text,
    serial_numbers text,
    operator_name text,
    confirmed_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by text
);


--
-- Name: work_order_issues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_order_issues (
    id text NOT NULL,
    tenant_id text NOT NULL,
    work_order_id text NOT NULL,
    component_id text,
    confirmation_id text,
    product_id text NOT NULL,
    quantity numeric(19,4) NOT NULL,
    unit_cost numeric(19,4) DEFAULT 0 NOT NULL,
    total_cost numeric(19,4) DEFAULT 0 NOT NULL,
    material_cost numeric(19,4) DEFAULT 0 NOT NULL,
    scrap_cost numeric(19,4) DEFAULT 0 NOT NULL,
    mode text DEFAULT 'MANUAL'::text NOT NULL,
    lot_number text,
    serial_number text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by text
);


--
-- Name: work_order_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_order_operations (
    id text NOT NULL,
    tenant_id text NOT NULL,
    work_order_id text NOT NULL,
    sequence integer NOT NULL,
    name text NOT NULL,
    workstation_id text,
    setup_minutes numeric(19,4) DEFAULT 0 NOT NULL,
    run_minutes_per_unit numeric(19,4) DEFAULT 0 NOT NULL,
    no_of_workers integer DEFAULT 1 NOT NULL,
    is_subcontract boolean DEFAULT false NOT NULL,
    subcontract_cost_per_unit numeric(19,4) DEFAULT 0 NOT NULL,
    machine_rate_per_hour numeric(19,4) DEFAULT 0 NOT NULL,
    instructions text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    running_since timestamp(3) without time zone,
    actual_machine_minutes numeric(19,4) DEFAULT 0 NOT NULL,
    yield_qty numeric(19,4) DEFAULT 0 NOT NULL,
    scrap_qty numeric(19,4) DEFAULT 0 NOT NULL,
    rework_qty numeric(19,4) DEFAULT 0 NOT NULL
);


--
-- Name: work_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_orders (
    id text NOT NULL,
    tenant_id text NOT NULL,
    order_number text NOT NULL,
    product_id text NOT NULL,
    bom_id text,
    routing_id text,
    warehouse_id text,
    quantity numeric(19,4) NOT NULL,
    quantity_completed numeric(19,4) DEFAULT 0 NOT NULL,
    quantity_scrapped numeric(19,4) DEFAULT 0 NOT NULL,
    quantity_rework numeric(19,4) DEFAULT 0 NOT NULL,
    quantity_receipted numeric(19,4) DEFAULT 0 NOT NULL,
    status text DEFAULT 'CREATED'::text NOT NULL,
    priority text DEFAULT 'MEDIUM'::text NOT NULL,
    issue_mode text DEFAULT 'BACKFLUSH'::text NOT NULL,
    start_date timestamp(3) without time zone,
    end_date timestamp(3) without time zone,
    assigned_to text,
    notes text,
    source_type text DEFAULT 'MANUAL'::text NOT NULL,
    source_id text,
    sales_order_id text,
    sales_order_item_id text,
    legacy_job_id text,
    legacy_order_id text,
    labour_rate_per_hour numeric(19,4) DEFAULT 0 NOT NULL,
    overhead_percent numeric(19,4) DEFAULT 0 NOT NULL,
    planned_material_cost numeric(19,4) DEFAULT 0 NOT NULL,
    planned_labour_cost numeric(19,4) DEFAULT 0 NOT NULL,
    planned_machine_cost numeric(19,4) DEFAULT 0 NOT NULL,
    planned_overhead_cost numeric(19,4) DEFAULT 0 NOT NULL,
    planned_scrap_cost numeric(19,4) DEFAULT 0 NOT NULL,
    planned_subcontract_cost numeric(19,4) DEFAULT 0 NOT NULL,
    actual_material_cost numeric(19,4) DEFAULT 0 NOT NULL,
    actual_labour_cost numeric(19,4) DEFAULT 0 NOT NULL,
    actual_machine_cost numeric(19,4) DEFAULT 0 NOT NULL,
    actual_overhead_cost numeric(19,4) DEFAULT 0 NOT NULL,
    actual_scrap_cost numeric(19,4) DEFAULT 0 NOT NULL,
    actual_subcontract_cost numeric(19,4) DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    created_by text
);


--
-- Name: cost_layers cost_layers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_layers
    ADD CONSTRAINT cost_layers_pkey PRIMARY KEY (id);


--
-- Name: material_reservations material_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_reservations
    ADD CONSTRAINT material_reservations_pkey PRIMARY KEY (id);


--
-- Name: operation_time_logs operation_time_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_time_logs
    ADD CONSTRAINT operation_time_logs_pkey PRIMARY KEY (id);


--
-- Name: production_settings production_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_settings
    ADD CONSTRAINT production_settings_pkey PRIMARY KEY (id);


--
-- Name: reason_codes reason_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reason_codes
    ADD CONSTRAINT reason_codes_pkey PRIMARY KEY (id);


--
-- Name: routing_operations routing_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routing_operations
    ADD CONSTRAINT routing_operations_pkey PRIMARY KEY (id);


--
-- Name: routings routings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routings
    ADD CONSTRAINT routings_pkey PRIMARY KEY (id);


--
-- Name: work_order_components work_order_components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_components
    ADD CONSTRAINT work_order_components_pkey PRIMARY KEY (id);


--
-- Name: work_order_confirmations work_order_confirmations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_confirmations
    ADD CONSTRAINT work_order_confirmations_pkey PRIMARY KEY (id);


--
-- Name: work_order_issues work_order_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_issues
    ADD CONSTRAINT work_order_issues_pkey PRIMARY KEY (id);


--
-- Name: work_order_operations work_order_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_operations
    ADD CONSTRAINT work_order_operations_pkey PRIMARY KEY (id);


--
-- Name: work_orders work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_pkey PRIMARY KEY (id);


--
-- Name: cost_layers_product_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cost_layers_product_id_idx ON public.cost_layers USING btree (product_id);


--
-- Name: cost_layers_received_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cost_layers_received_at_idx ON public.cost_layers USING btree (received_at);


--
-- Name: cost_layers_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cost_layers_tenant_id_idx ON public.cost_layers USING btree (tenant_id);


--
-- Name: material_reservations_product_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX material_reservations_product_id_idx ON public.material_reservations USING btree (product_id);


--
-- Name: material_reservations_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX material_reservations_tenant_id_idx ON public.material_reservations USING btree (tenant_id);


--
-- Name: material_reservations_work_order_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX material_reservations_work_order_id_idx ON public.material_reservations USING btree (work_order_id);


--
-- Name: operation_time_logs_operation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX operation_time_logs_operation_id_idx ON public.operation_time_logs USING btree (operation_id);


--
-- Name: operation_time_logs_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX operation_time_logs_tenant_id_idx ON public.operation_time_logs USING btree (tenant_id);


--
-- Name: production_settings_tenant_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX production_settings_tenant_id_key ON public.production_settings USING btree (tenant_id);


--
-- Name: reason_codes_tenant_id_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX reason_codes_tenant_id_code_key ON public.reason_codes USING btree (tenant_id, code);


--
-- Name: reason_codes_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reason_codes_tenant_id_idx ON public.reason_codes USING btree (tenant_id);


--
-- Name: routing_operations_routing_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX routing_operations_routing_id_idx ON public.routing_operations USING btree (routing_id);


--
-- Name: routing_operations_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX routing_operations_tenant_id_idx ON public.routing_operations USING btree (tenant_id);


--
-- Name: routings_bom_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX routings_bom_id_key ON public.routings USING btree (bom_id);


--
-- Name: routings_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX routings_tenant_id_idx ON public.routings USING btree (tenant_id);


--
-- Name: work_order_components_product_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_order_components_product_id_idx ON public.work_order_components USING btree (product_id);


--
-- Name: work_order_components_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_order_components_tenant_id_idx ON public.work_order_components USING btree (tenant_id);


--
-- Name: work_order_components_work_order_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_order_components_work_order_id_idx ON public.work_order_components USING btree (work_order_id);


--
-- Name: work_order_confirmations_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_order_confirmations_tenant_id_idx ON public.work_order_confirmations USING btree (tenant_id);


--
-- Name: work_order_confirmations_work_order_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_order_confirmations_work_order_id_idx ON public.work_order_confirmations USING btree (work_order_id);


--
-- Name: work_order_issues_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_order_issues_tenant_id_idx ON public.work_order_issues USING btree (tenant_id);


--
-- Name: work_order_issues_work_order_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_order_issues_work_order_id_idx ON public.work_order_issues USING btree (work_order_id);


--
-- Name: work_order_operations_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_order_operations_tenant_id_idx ON public.work_order_operations USING btree (tenant_id);


--
-- Name: work_order_operations_work_order_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_order_operations_work_order_id_idx ON public.work_order_operations USING btree (work_order_id);


--
-- Name: work_orders_legacy_job_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX work_orders_legacy_job_id_key ON public.work_orders USING btree (legacy_job_id);


--
-- Name: work_orders_legacy_order_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX work_orders_legacy_order_id_key ON public.work_orders USING btree (legacy_order_id);


--
-- Name: work_orders_product_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_orders_product_id_idx ON public.work_orders USING btree (product_id);


--
-- Name: work_orders_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_orders_status_idx ON public.work_orders USING btree (status);


--
-- Name: work_orders_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_orders_tenant_id_idx ON public.work_orders USING btree (tenant_id);


--
-- Name: work_orders_tenant_id_order_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX work_orders_tenant_id_order_number_key ON public.work_orders USING btree (tenant_id, order_number);


--
-- Name: cost_layers cost_layers_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_layers
    ADD CONSTRAINT cost_layers_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: cost_layers cost_layers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_layers
    ADD CONSTRAINT cost_layers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: material_reservations material_reservations_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_reservations
    ADD CONSTRAINT material_reservations_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.work_order_components(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: material_reservations material_reservations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_reservations
    ADD CONSTRAINT material_reservations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: material_reservations material_reservations_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_reservations
    ADD CONSTRAINT material_reservations_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: operation_time_logs operation_time_logs_operation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_time_logs
    ADD CONSTRAINT operation_time_logs_operation_id_fkey FOREIGN KEY (operation_id) REFERENCES public.work_order_operations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: operation_time_logs operation_time_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_time_logs
    ADD CONSTRAINT operation_time_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: production_settings production_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_settings
    ADD CONSTRAINT production_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reason_codes reason_codes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reason_codes
    ADD CONSTRAINT reason_codes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: routing_operations routing_operations_routing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routing_operations
    ADD CONSTRAINT routing_operations_routing_id_fkey FOREIGN KEY (routing_id) REFERENCES public.routings(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: routing_operations routing_operations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routing_operations
    ADD CONSTRAINT routing_operations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: routing_operations routing_operations_workstation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routing_operations
    ADD CONSTRAINT routing_operations_workstation_id_fkey FOREIGN KEY (workstation_id) REFERENCES public.workstations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: routings routings_bom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routings
    ADD CONSTRAINT routings_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES public.boms(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: routings routings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routings
    ADD CONSTRAINT routings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: work_order_components work_order_components_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_components
    ADD CONSTRAINT work_order_components_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: work_order_components work_order_components_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_components
    ADD CONSTRAINT work_order_components_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: work_order_components work_order_components_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_components
    ADD CONSTRAINT work_order_components_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: work_order_confirmations work_order_confirmations_operation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_confirmations
    ADD CONSTRAINT work_order_confirmations_operation_id_fkey FOREIGN KEY (operation_id) REFERENCES public.work_order_operations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: work_order_confirmations work_order_confirmations_rework_reason_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_confirmations
    ADD CONSTRAINT work_order_confirmations_rework_reason_id_fkey FOREIGN KEY (rework_reason_id) REFERENCES public.reason_codes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: work_order_confirmations work_order_confirmations_scrap_reason_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_confirmations
    ADD CONSTRAINT work_order_confirmations_scrap_reason_id_fkey FOREIGN KEY (scrap_reason_id) REFERENCES public.reason_codes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: work_order_confirmations work_order_confirmations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_confirmations
    ADD CONSTRAINT work_order_confirmations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: work_order_confirmations work_order_confirmations_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_confirmations
    ADD CONSTRAINT work_order_confirmations_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: work_order_issues work_order_issues_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_issues
    ADD CONSTRAINT work_order_issues_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.work_order_components(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: work_order_issues work_order_issues_confirmation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_issues
    ADD CONSTRAINT work_order_issues_confirmation_id_fkey FOREIGN KEY (confirmation_id) REFERENCES public.work_order_confirmations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: work_order_issues work_order_issues_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_issues
    ADD CONSTRAINT work_order_issues_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: work_order_issues work_order_issues_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_issues
    ADD CONSTRAINT work_order_issues_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: work_order_operations work_order_operations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_operations
    ADD CONSTRAINT work_order_operations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: work_order_operations work_order_operations_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_operations
    ADD CONSTRAINT work_order_operations_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: work_order_operations work_order_operations_workstation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_operations
    ADD CONSTRAINT work_order_operations_workstation_id_fkey FOREIGN KEY (workstation_id) REFERENCES public.workstations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: work_orders work_orders_bom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES public.boms(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: work_orders work_orders_legacy_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_legacy_job_id_fkey FOREIGN KEY (legacy_job_id) REFERENCES public.production_jobs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: work_orders work_orders_legacy_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_legacy_order_id_fkey FOREIGN KEY (legacy_order_id) REFERENCES public.production_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: work_orders work_orders_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: work_orders work_orders_routing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_routing_id_fkey FOREIGN KEY (routing_id) REFERENCES public.routings(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: work_orders work_orders_sales_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_sales_order_id_fkey FOREIGN KEY (sales_order_id) REFERENCES public.sales_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: work_orders work_orders_sales_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_sales_order_item_id_fkey FOREIGN KEY (sales_order_item_id) REFERENCES public.sales_order_items(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: work_orders work_orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: work_orders work_orders_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
--


