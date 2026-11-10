const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runSeed() {
  // We will seed for both the Prologics tenant and the Mfg test tenant if they exist
  const tenantIds = [
    '559b8d66-70a5-4c59-90a3-47dcd3baab5a', // Prologics
    'f4f2ab50-ce6a-4f9b-a354-e656d6a4d673'  // Test Advanced Manufacturing Tenant
  ];

  for (const tenantId of tenantIds) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      console.log(`Tenant ${tenantId} not found, skipping.`);
      continue;
    }
    console.log(`\n=============================================`);
    console.log(`Seeding MRP & Planning Board Demo Data for Tenant: ${tenant.name} (${tenantId})`);
    console.log(`=============================================`);

    // 1. Ensure a default warehouse exists
    let warehouse = await prisma.warehouse.findFirst({ where: { tenantId } });
    if (!warehouse) {
      warehouse = await prisma.warehouse.create({
        data: {
          tenantId,
          code: 'WH-MAIN-01',
          name: 'Main Assembly Warehouse',
          address: 'Factory Zone A, Build 3',
          createdBy: 'System'
        }
      });
      console.log(`Created Warehouse: ${warehouse.code}`);
    } else {
      console.log(`Found existing Warehouse: ${warehouse.code}`);
    }

    // 2. Create Workstations if they don't exist
    const workstationDefs = [
      { code: 'WS-FRAME', name: 'Frame Assembly Station', description: 'Assembly of metal frame and mesh support', hourlyRate: 25.00, efficiency: 0.95, capacity: 2 },
      { code: 'WS-MOUNT', name: 'Cushion & Armrest Mounting', description: 'Attaching seat cushion and adjustable armrests', hourlyRate: 20.00, efficiency: 0.90, capacity: 2 },
      { code: 'WS-BASE', name: 'Base & Cylinder Assembly', description: 'Assembling star base, casters, and cylinder', hourlyRate: 18.00, efficiency: 0.98, capacity: 3 },
      { code: 'WS-QC', name: 'Final Quality Inspection', description: 'Checking ergonomics, movement, and finish quality', hourlyRate: 30.00, efficiency: 1.00, capacity: 1 }
    ];

    const workstations = [];
    for (const def of workstationDefs) {
      let ws = await prisma.workstation.findFirst({
        where: { tenantId, code: def.code }
      });
      if (!ws) {
        ws = await prisma.workstation.create({
          data: {
            tenantId,
            ...def,
            createdBy: 'System'
          }
        });
        console.log(`Created Workstation: ${ws.name} (${ws.code})`);
      } else {
        console.log(`Found Workstation: ${ws.name} (${ws.code})`);
      }
      workstations.push(ws);
    }

    // 3. Create Unit of Measure if it doesn't exist
    let pcsUom = await prisma.unitOfMeasure.findFirst({
      where: { tenantId, name: 'Pcs' }
    });
    if (!pcsUom) {
      pcsUom = await prisma.unitOfMeasure.create({
        data: {
          tenantId,
          name: 'Pcs'
        }
      });
      console.log(`Created UoM: Pcs`);
    }

    // 4. Create Products (Finished Good & Raw Materials)
    const productDefs = [
      // Finished Good
      { code: 'FG-CHAIR-100', name: 'Ergonomic Office Chair', description: 'High-end ergonomic office chair with mesh backrest and adjustable arms', costPrice: 120.00, sellingPrice: 250.00, bomApplicable: true, type: 'PRODUCT' },
      // Components
      { code: 'RM-WHEEL-100', name: 'Heavy Duty Caster Wheel', description: '50mm nylon caster wheels for office chairs', costPrice: 5.00, sellingPrice: 8.00, bomApplicable: false, type: 'PRODUCT' },
      { code: 'RM-LIFT-100', name: 'Hydraulic Gas Lift Cylinder', description: 'Class 4 heavy duty gas cylinder', costPrice: 15.00, sellingPrice: 25.00, bomApplicable: false, type: 'PRODUCT' },
      { code: 'RM-CUSHION-100', name: 'Molded Foam Seat Cushion', description: 'High density memory foam cushion', costPrice: 25.00, sellingPrice: 45.00, bomApplicable: false, type: 'PRODUCT' },
      { code: 'RM-BACK-100', name: 'Premium Mesh Backrest', description: 'Breathable ergonomic lumbar support mesh backrest', costPrice: 30.00, sellingPrice: 55.00, bomApplicable: false, type: 'PRODUCT' },
      { code: 'RM-ARMREST-100', name: 'Adjustable Armrest Set', description: '3D adjustable armrests (left & right pair)', costPrice: 20.00, sellingPrice: 35.00, bomApplicable: false, type: 'PRODUCT' }
    ];

    const products = {};
    for (const def of productDefs) {
      let prod = await prisma.product.findFirst({
        where: { tenantId, code: def.code }
      });
      if (!prod) {
        prod = await prisma.product.create({
          data: {
            tenantId,
            ...def,
            uomId: pcsUom.id,
            createdBy: 'System'
          }
        });
        console.log(`Created Product: ${prod.name} (${prod.code})`);
      } else {
        // Ensure bomApplicable is set correctly
        if (prod.bomApplicable !== def.bomApplicable) {
          prod = await prisma.product.update({
            where: { id: prod.id },
            data: { bomApplicable: def.bomApplicable }
          });
          console.log(`Updated product bomApplicable status for: ${prod.name}`);
        }
        console.log(`Found Product: ${prod.name} (${prod.code})`);
      }
      products[def.code] = prod;
    }

    // 5. Create BOM for the Ergonomic Chair
    const chairProduct = products['FG-CHAIR-100'];
    let bom = await prisma.bOM.findFirst({
      where: { tenantId, productId: chairProduct.id, code: 'BOM-CHAIR-V1' }
    });

    const routingSteps = [
      { seq: 1, name: 'Frame & Mesh Assembly', workstation: 'WS-FRAME', durationMin: 20 },
      { seq: 2, name: 'Cushion & Armrest Mounting', workstation: 'WS-MOUNT', durationMin: 15 },
      { seq: 3, name: 'Base & Cylinder Assembly', workstation: 'WS-BASE', durationMin: 10 },
      { seq: 4, name: 'Final Quality Inspection', workstation: 'WS-QC', durationMin: 5 }
    ];

    if (!bom) {
      bom = await prisma.bOM.create({
        data: {
          tenantId,
          productId: chairProduct.id,
          code: 'BOM-CHAIR-V1',
          name: 'Ergonomic Office Chair Assembly BOM',
          version: '1.0',
          status: 'ACTIVE',
          isDefault: true,
          routingSteps: routingSteps,
          totalCost: 120.00,
          createdBy: 'System'
        }
      });
      console.log(`Created Bill of Materials: ${bom.name} (${bom.code})`);

      // Add BOM Items (Components)
      // Quantity per Chair: 5 wheels, 1 cylinder, 1 cushion, 1 backrest, 1 armrest
      const bomComponents = [
        { code: 'RM-WHEEL-100', quantity: 5 },
        { code: 'RM-LIFT-100', quantity: 1 },
        { code: 'RM-CUSHION-100', quantity: 1 },
        { code: 'RM-BACK-100', quantity: 1 },
        { code: 'RM-ARMREST-100', quantity: 1 }
      ];

      for (const comp of bomComponents) {
        await prisma.bOMItem.create({
          data: {
            tenantId,
            bomId: bom.id,
            productId: products[comp.code].id,
            quantity: comp.quantity,
            scrapPercent: 0.0
          }
        });
      }
      console.log(`Added components to BOM: ${bom.code}`);
    } else {
      console.log(`Found existing BOM: ${bom.code}`);
    }

    // 6. Delete old stock movements for demo products to ensure predictable MRP results
    const productIds = Object.values(products).map(p => p.id);
    await prisma.stockMovement.deleteMany({
      where: {
        tenantId,
        productId: { in: productIds }
      }
    });
    console.log(`Cleared previous stock movements for demo products`);

    // 7. Seed Initial Stock Levels (Goods Receipts "GR")
    // Needs per chair: 5 Wheels, 1 Lift, 1 Cushion, 1 Back, 1 Armrest
    // Let's plan for 15 chairs (Demand = 75 Wheels, 15 Lifts, 15 Cushions, 15 Backs, 15 Armrests)
    // Initial Stock:
    // - Wheels: 30 pcs (Shortage: 45) -> will trigger Purchase Requisition Suggestion
    // - Lifts: 18 pcs (Shortage: 0) -> No suggestion
    // - Cushions: 2 pcs (Shortage: 13) -> will trigger Purchase Requisition Suggestion
    // - Backrests: 5 pcs (Shortage: 10) -> will trigger Purchase Requisition Suggestion
    // - Armrests: 20 pcs (Shortage: 0) -> No suggestion
    const stockLevels = [
      { code: 'RM-WHEEL-100', qty: 30 },
      { code: 'RM-LIFT-100', qty: 18 },
      { code: 'RM-CUSHION-100', qty: 2 },
      { code: 'RM-BACK-100', qty: 5 },
      { code: 'RM-ARMREST-100', qty: 20 }
    ];

    for (const sl of stockLevels) {
      await prisma.stockMovement.create({
        data: {
          tenantId,
          productId: products[sl.code].id,
          warehouseId: warehouse.id,
          type: 'GR',
          quantity: sl.qty,
          referenceType: 'INITIAL_STOCK',
          createdBy: 'System'
        }
      });
      console.log(`Seeded Stock: ${sl.qty} units of ${sl.code}`);
    }

    // 8. Delete old production orders & jobs for these products to refresh
    await prisma.productionOrder.deleteMany({
      where: {
        tenantId,
        productId: chairProduct.id
      }
    });
    await prisma.productionJob.deleteMany({
      where: {
        tenantId,
        productId: chairProduct.id
      }
    });
    console.log(`Cleared previous production orders and jobs`);

    // 9. Create Production Orders (demand for MRP)
    // Order 1: RELEASED (10 chairs) -> Active Demand
    // Order 2: WIP (5 chairs) -> Active Demand
    // Total chair demand = 15 chairs
    const ordersToCreate = [
      { orderNumber: 'MPO-2026-0001', quantity: 10, status: 'RELEASED', startDate: new Date('2026-06-10T08:00:00Z'), endDate: new Date('2026-06-15T17:00:00Z') },
      { orderNumber: 'MPO-2026-0002', quantity: 5, status: 'WIP', startDate: new Date('2026-06-12T08:00:00Z'), endDate: new Date('2026-06-16T17:00:00Z') }
    ];

    for (const ord of ordersToCreate) {
      await prisma.productionOrder.create({
        data: {
          tenantId,
          productId: chairProduct.id,
          bomId: bom.id,
          orderNumber: ord.orderNumber,
          quantity: ord.quantity,
          status: ord.status,
          startDate: ord.startDate,
          endDate: ord.endDate,
          createdBy: 'System'
        }
      });
      console.log(`Created Production Order: ${ord.orderNumber} (Qty: ${ord.quantity}, Status: ${ord.status})`);
    }

    // 10. Create Production Jobs (for Planning Board & Gantt chart)
    const jobsToCreate = [
      { jobNumber: 'JB-2026-0001', quantity: 4, status: 'COMPLETED', priority: 'MEDIUM', startDate: new Date('2026-06-01T08:00:00'), endDate: new Date('2026-06-02T17:00:00'), assignedTo: 'John Doe', workCenterId: 'WS-FRAME' },
      { jobNumber: 'JB-2026-0002', quantity: 2, status: 'QC', priority: 'HIGH', startDate: new Date('2026-06-05T08:00:00'), endDate: new Date('2026-06-06T17:00:00'), assignedTo: 'Jane Smith', workCenterId: 'WS-QC' },
      { jobNumber: 'JB-2026-0003', quantity: 5, status: 'WIP', priority: 'CRITICAL', startDate: new Date('2026-06-10T08:00:00'), endDate: new Date('2026-06-12T17:00:00'), assignedTo: 'Alex Rivera', workCenterId: 'WS-MOUNT' },
      { jobNumber: 'JB-2026-0004', quantity: 8, status: 'QUEUED', priority: 'MEDIUM', startDate: new Date('2026-06-15T08:00:00'), endDate: new Date('2026-06-18T17:00:00'), assignedTo: 'Unassigned', workCenterId: 'WS-BASE' },
      { jobNumber: 'JB-2026-0005', quantity: 3, status: 'QUEUED', priority: 'LOW', startDate: null, endDate: null, assignedTo: 'Unassigned', workCenterId: 'WS-BASE' }
    ];

    for (const job of jobsToCreate) {
      await prisma.productionJob.create({
        data: {
          tenantId,
          productId: chairProduct.id,
          bomId: bom.id,
          jobNumber: job.jobNumber,
          quantity: job.quantity,
          status: job.status,
          priority: job.priority,
          startDate: job.startDate,
          endDate: job.endDate,
          assignedTo: job.assignedTo,
          workCenterId: job.workCenterId,
          notes: `Demo job card ${job.jobNumber} initialized via seeding.`
        }
      });
      console.log(`Created Production Job: ${job.jobNumber} (Status: ${job.status}, Assigned: ${job.assignedTo})`);
    }

    console.log(`Demo seeding completed successfully for ${tenant.name}.`);
  }
}

runSeed()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
