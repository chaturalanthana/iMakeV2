const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const brand = await prisma.productBrand.findFirst({
    where: { name: 'TEST' }
  });
  const product = await prisma.product.findFirst();

  if (brand && product) {
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: { brandId: brand.id }
    });
    console.log('Assigned product to brand TEST:', updated.name, '->', brand.name);
  } else {
    console.log('Brand or Product not found');
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
