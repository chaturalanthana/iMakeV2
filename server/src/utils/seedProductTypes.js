const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const defaultProductTypes = [
  { name: 'Service Material', description: 'Service material or non-inventory service items' },
  { name: 'Raw Material', description: 'Raw materials used in production' },
  { name: 'Product ( Finish Good ) Material', description: 'Finished goods ready for sale' },
  { name: 'Semi-Finishgood Material', description: 'Semi-finished goods or sub-assemblies' }
];

async function seed() {
  try {
    console.log('Fetching all tenants...');
    const tenants = await prisma.tenant.findMany();
    console.log(`Found ${tenants.length} tenants. Seeding default product types...`);

    for (const tenant of tenants) {
      console.log(`Seeding tenant: ${tenant.name} (${tenant.id})`);
      for (const pt of defaultProductTypes) {
        await prisma.productType.upsert({
          where: {
            tenantId_name: {
              tenantId: tenant.id,
              name: pt.name
            }
          },
          update: {
            description: pt.description
          },
          create: {
            tenantId: tenant.id,
            name: pt.name,
            description: pt.description
          }
        });
      }
    }
    console.log('Seeding finished successfully.');
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
