const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const brands = await prisma.productBrand.findMany({
    include: {
      _count: {
        select: { products: true }
      }
    }
  });
  console.log(JSON.stringify(brands, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
