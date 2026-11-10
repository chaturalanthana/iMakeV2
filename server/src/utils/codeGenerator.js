const prisma = require('../lib/prisma');

/**
 * Generates a sequenced document number for various ERP modules.
 * Pattern: PREFIX/YYYY/MM/XXXXX
 * 
 * @param {string} tenantId - The current tenant ID
 * @param {string} modelName - The Prisma model name (e.g., 'salesQuotation')
 * @param {string} prefix - The document prefix (e.g., 'QUO', 'SO', 'INV', 'DO', 'PO', 'GRN')
 * @param {string} fieldName - The database field name for the document number (e.g., 'quotationNumber')
 */
const generateDocumentNumber = async (tenantId, modelName, prefix, fieldName, db = prisma) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthPrefix = `${prefix}/${year}/${month}/`;

  const rows = await db[modelName].findMany({
    where: {
      tenantId,
      [fieldName]: { startsWith: monthPrefix }
    },
    select: { [fieldName]: true }
  });

  const pattern = new RegExp(`^${monthPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);
  let max = 0;
  rows.forEach((row) => {
    const match = pattern.exec(row[fieldName] || '');
    if (match) max = Math.max(max, parseInt(match[1], 10));
  });

  return `${monthPrefix}${String(max + 1).padStart(5, '0')}`;
};

module.exports = {
  generateDocumentNumber
};
