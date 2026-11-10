const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      standardCost: true,
      uom: {
        select: {
          name: true
        }
      }
    }
  });
  console.log('Products standard cost & UOM in DB:');
  console.log(JSON.stringify(products, null, 2));

  const boms = await prisma.bOM.findMany({
    include: {
      items: {
        include: {
          componentProduct: {
            select: {
              code: true,
              standardCost: true,
              uom: { select: { name: true } }
            }
          }
        }
      }
    }
  });
  console.log('BOMs in DB:');
  console.log(JSON.stringify(boms, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
