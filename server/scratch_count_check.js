const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- BRANDS ---');
  const brands = await prisma.productBrand.findMany({
    include: {
      _count: {
        select: { products: true }
      }
    }
  });
  console.log(JSON.stringify(brands, null, 2));

  console.log('--- PRODUCTS ---');
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      brandId: true,
      categoryId: true
    }
  });
  console.log(JSON.stringify(products, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
