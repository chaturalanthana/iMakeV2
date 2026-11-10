const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const productsWithBrand = await prisma.product.findMany({
    where: {
      brandId: { not: null }
    },
    select: {
      id: true,
      name: true,
      brandId: true,
      brand: {
        select: {
          name: true
        }
      }
    }
  });
  console.log('Products with brand:', JSON.stringify(productsWithBrand, null, 2));

  const allProducts = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      brandId: true,
      categoryId: true
    }
  });
  console.log('All products count:', allProducts.length);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
