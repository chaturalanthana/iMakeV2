const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const brands = await prisma.productBrand.findMany({
    select: {
      id: true,
      name: true,
      parentId: true,
      _count: {
        select: { products: true }
      }
    }
  });
  console.log('BRANDS:');
  brands.forEach(b => {
    console.log(`Name: ${b.name}, ID: ${b.id}, ParentID: ${b.parentId}, Direct Products: ${b._count.products}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
