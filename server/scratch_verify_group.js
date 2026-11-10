const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Testing Prisma connection and ProductGroup model...');
  try {
    const tenants = await prisma.tenant.findMany({ take: 1 });
    if (tenants.length === 0) {
      console.log('No tenants found.');
      return;
    }
    const tenantId = tenants[0].id;
    console.log(`Using Tenant ID: ${tenantId}`);

    // Create a product group
    console.log('Creating test product group...');
    const group = await prisma.productGroup.create({
      data: {
        tenantId: tenantId,
        name: 'Test Metal Materials'
      }
    });
    console.log('Created product group:', group);

    // Create a sub-group
    console.log('Creating sub-group...');
    const subGroup = await prisma.productGroup.create({
      data: {
        tenantId: tenantId,
        name: 'Copper Wires',
        parentId: group.id
      }
    });
    console.log('Created sub-group:', subGroup);

    // Fetch hierarchical tree
    const allGroups = await prisma.productGroup.findMany({
      where: { tenantId },
      include: { subGroups: true }
    });
    console.log('All product groups with subGroups:', JSON.stringify(allGroups, null, 2));

    // Cleanup
    console.log('Cleaning up test groups...');
    await prisma.productGroup.delete({ where: { id: subGroup.id } });
    await prisma.productGroup.delete({ where: { id: group.id } });
    console.log('Cleanup complete.');
  } catch (err) {
    console.error('Error running test:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
