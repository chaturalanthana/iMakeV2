require('dotenv').config();
const { ensureAllProductTypes } = require('../services/productTypes');
const prisma = require('../lib/prisma');

ensureAllProductTypes()
  .then(() => {
    console.log('Product types are ready.');
  })
  .catch((error) => {
    console.error('Product type regeneration failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
