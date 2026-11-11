const prisma = require('../lib/prisma');
const { receiveLayer } = require('../services/production/fifo');

const layerFromReceipt = async (db, { tenantId, productId, warehouseId, quantity, unitCost, sourceId }) => {
  let cost = parseFloat(unitCost || 0);
  if (!(cost > 0)) {
    const product = await db.product.findFirst({ where: { id: productId, tenantId } });
    cost = parseFloat(product?.standardCost || product?.costPrice || 0);
  }
  await receiveLayer(db, {
    tenantId,
    productId,
    warehouseId: warehouseId || null,
    quantity: parseFloat(quantity),
    unitCost: cost,
    sourceType: 'SR',
    sourceId
  });
};

const getStockLedger = async (req, res) => {
  try {
    const { productId, startDate, endDate, warehouseId } = req.query;
    
    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required for ledger' });
    }

    let openingBalance = 0;
    
    if (startDate) {
      const priorWhere = {
        tenantId: req.tenantId,
        productId: productId,
        createdAt: { lt: new Date(startDate) }
      };
      if (warehouseId) priorWhere.warehouseId = warehouseId;

      const priorMovements = await prisma.stockMovement.findMany({
        where: priorWhere
      });
      
      openingBalance = priorMovements.reduce((acc, m) => {
        return m.type === 'GI' ? acc - parseFloat(m.quantity) : acc + parseFloat(m.quantity);
      }, 0);
    }

    const whereClause = {
      tenantId: req.tenantId,
      productId: productId,
    };
    if (warehouseId) whereClause.warehouseId = warehouseId;

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = end;
      }
    }

    const movements = await prisma.stockMovement.findMany({
      where: whereClause,
      include: { product: true },
      orderBy: { createdAt: 'asc' }
    });
    
    // Resolve UUIDs to readable document numbers
    const enhancedMovements = await Promise.all(movements.map(async (m) => {
      let readableReference = m.referenceId;
      try {
        if (m.referenceType === 'GI' && m.referenceId) {
          const doc = await prisma.goodsIssue.findUnique({ where: { id: m.referenceId }});
          if (doc) readableReference = doc.giNumber;
        } else if (m.referenceType === 'ADJ' && m.referenceId) {
          const doc = await prisma.stockAdjustment.findUnique({ where: { id: m.referenceId }});
          if (doc) readableReference = doc.adjNumber;
        } else if (m.referenceType === 'GR' && m.referenceId) {
          const doc = await prisma.gRN.findUnique({ where: { id: m.referenceId }});
          if (doc) readableReference = doc.grnNumber;
        } else if (m.referenceType === 'SR' && m.referenceId) {
          const doc = await prisma.stockReceipt.findUnique({ where: { id: m.referenceId }});
          if (doc) readableReference = doc.receiptNumber;
        } else if (m.referenceType === 'ST' && m.referenceId) {
          const doc = await prisma.stockTransfer.findUnique({ where: { id: m.referenceId }});
          if (doc) readableReference = doc.transferNumber;
        }
      } catch (err) {
        // Fallback to original referenceId if lookup fails
      }
      return {
        ...m,
        originalReferenceId: m.referenceId,
        referenceId: readableReference || '-',
      };
    }));
    
    res.json({ openingBalance, movements: enhancedMovements });
  } catch (error) {
    console.error('Failed to fetch stock ledger:', error);
    res.status(500).json({ error: 'Failed to fetch stock ledger' });
  }
};


const getStockMovements = async (req, res) => {
  try {
    const { type } = req.query; // 'GI' or 'ADJ' or empty for all
    
    let whereClause = { tenantId: req.tenantId };
    if (type) {
      whereClause.type = type;
    }

    const movements = await prisma.stockMovement.findMany({
      where: whereClause,
      include: { product: true },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(movements);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stock movements' });
  }
};

const createStockMovement = async (req, res) => {
  try {
    const { type, items, referenceType, referenceId, description } = req.body;
    
    // items: [{ productId, quantity }]
    // type: 'GI' | 'ADJ'
    if (!['GI', 'ADJ', 'GR'].includes(type)) {
      return res.status(400).json({ error: 'Invalid movement type.' });
    }

    const createdMovements = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (const item of items) {
        rows.push(await tx.stockMovement.create({
          data: {
            tenantId: req.tenantId,
            productId: item.productId,
            type: type,
            quantity: parseFloat(item.quantity),
            referenceType: referenceType || (type === 'GI' ? 'MANUAL_ISSUE' : 'MANUAL_ADJ'),
            referenceId: referenceId || description || '',
            createdBy: req.user.userId
          }
        }));
      }
      return rows;
    });

    res.status(201).json(createdMovements);
  } catch (error) {
    console.error('Failed to create stock movement:', error);
    res.status(500).json({ error: 'Failed to create stock movement' });
  }
};

const deleteStockMovement = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.stockMovement.delete({ where: { id, tenantId: req.tenantId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete stock movement' });
  }
};

const getGoodsIssues = async (req, res) => {
  try {
    const issues = await prisma.goodsIssue.findMany({
      where: { tenantId: req.tenantId },
      include: {
        supplier: true,
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(issues);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch goods issues' });
  }
};

const createGoodsIssue = async (req, res) => {
  try {
    const { supplierId, date, status, reason, items } = req.body;
    let totalAmount = 0;
    if (items) items.forEach(i => totalAmount += parseFloat(i.total || 0));

    const giNumber = await require('../utils/codeGenerator').generateDocumentNumber(
      req.tenantId,
      'goodsIssue',
      'GI',
      'giNumber'
    );

    const issue = await prisma.$transaction(async (tx) => {
      const created = await tx.goodsIssue.create({
        data: {
          tenantId: req.tenantId,
          supplierId: supplierId || null,
          giNumber,
          date: new Date(date),
          status: status || 'PENDING',
          reason: reason || null,
          total: totalAmount,
          createdBy: req.user?.userId || null,
          items: items && items.length > 0 ? {
            create: items.map(item => ({
              productId: item.productId,
              quantity: parseFloat(item.quantity),
              unitPrice: parseFloat(item.unitPrice || 0),
              total: parseFloat(item.total || 0)
            }))
          } : undefined
        },
        include: {
          supplier: true,
          items: { include: { product: true } }
        }
      });

      if (created.status === 'COMPLETED' || created.status === 'ISSUED') {
        for (const item of items) {
          await tx.stockMovement.create({
            data: {
              tenantId: req.tenantId,
              productId: item.productId,
              type: 'GI',
              quantity: parseFloat(item.quantity),
              referenceType: 'GI',
              referenceId: created.id,
              createdBy: req.user?.userId || null
            }
          });
        }
      }
      return created;
    });

    res.status(201).json(issue);
  } catch (error) {
    console.error('Failed to create Goods Issue:', error);
    res.status(500).json({ error: 'Failed to create Goods Issue' });
  }
};

const updateGoodsIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const { supplierId, date, status, reason, items } = req.body;

    const existing = await prisma.goodsIssue.findUnique({
      where: { id, tenantId: req.tenantId }
    });
    if (!existing) return res.status(404).json({ error: 'Goods Issue not found' });
    if (existing.status === 'COMPLETED' || existing.status === 'ISSUED') {
      return res.status(400).json({ error: 'Cannot modify a completed stock movement.' });
    }

    let totalAmount = 0;
    if (items) items.forEach(i => totalAmount += parseFloat(i.total || 0));

    const updated = await prisma.$transaction(async (tx) => {
      await tx.goodsIssueItem.deleteMany({
        where: { giId: id }
      });

      const saved = await tx.goodsIssue.update({
        where: { id },
        data: {
          supplierId: supplierId || null,
          date: date ? new Date(date) : existing.date,
          status: status || existing.status,
          reason: reason !== undefined ? reason : existing.reason,
          total: totalAmount,
          items: items && items.length > 0 ? {
            create: items.map(item => ({
              productId: item.productId,
              quantity: parseFloat(item.quantity),
              unitPrice: parseFloat(item.unitPrice || 0),
              total: parseFloat(item.total || 0)
            }))
          } : undefined
        },
        include: {
          supplier: true,
          items: { include: { product: true } }
        }
      });

      if (saved.status === 'COMPLETED' || saved.status === 'ISSUED') {
        for (const item of items) {
          await tx.stockMovement.create({
            data: {
              tenantId: req.tenantId,
              productId: item.productId,
              type: 'GI',
              quantity: parseFloat(item.quantity),
              referenceType: 'GI',
              referenceId: saved.id,
              createdBy: req.user?.userId || null
            }
          });
        }
      }
      return saved;
    });

    res.json(updated);
  } catch (error) {
    console.error('Failed to update GI:', error);
    res.status(500).json({ error: 'Failed to update Goods Issue' });
  }
};

const deleteGoodsIssue = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.goodsIssue.delete({ where: { id, tenantId: req.tenantId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete Goods Issue' });
  }
};

const getStockAdjustments = async (req, res) => {
  try {
    const adjs = await prisma.stockAdjustment.findMany({
      where: { tenantId: req.tenantId },
      include: {
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(adjs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch adjustments' });
  }
};

const createStockAdjustment = async (req, res) => {
  try {
    const { date, status, reason, items } = req.body;
    let totalAmount = 0;
    if (items) items.forEach(i => totalAmount += parseFloat(i.total || 0));

    const adjNumber = await require('../utils/codeGenerator').generateDocumentNumber(
      req.tenantId,
      'stockAdjustment',
      'ADJ',
      'adjNumber'
    );

    const adj = await prisma.$transaction(async (tx) => {
      const created = await tx.stockAdjustment.create({
        data: {
          tenantId: req.tenantId,
          adjNumber,
          date: new Date(date),
          status: status || 'PENDING',
          reason: reason || null,
          total: totalAmount,
          createdBy: req.user?.userId || null,
          items: items && items.length > 0 ? {
            create: items.map(item => ({
              productId: item.productId,
              systemQty: parseFloat(item.systemQty || 0),
              actualQty: parseFloat(item.actualQty || 0),
              diffQty: parseFloat(item.diffQty || 0),
              unitPrice: parseFloat(item.unitPrice || 0),
              total: parseFloat(item.total || 0)
            }))
          } : undefined
        },
        include: {
          items: { include: { product: true } }
        }
      });

      if (created.status === 'COMPLETED') {
        for (const item of items) {
          if (parseFloat(item.diffQty) !== 0) {
            await tx.stockMovement.create({
              data: {
                tenantId: req.tenantId,
                productId: item.productId,
                type: 'ADJ',
                quantity: parseFloat(item.diffQty),
                referenceType: 'ADJ',
                referenceId: created.id,
                createdBy: req.user?.userId || null
              }
            });
          }
        }
      }
      return created;
    });

    res.status(201).json(adj);
  } catch (error) {
    console.error('Failed to create ADJ:', error);
    res.status(500).json({ error: 'Failed to create Stock Adjustment' });
  }
};

const updateStockAdjustment = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, status, reason, items } = req.body;

    const existing = await prisma.stockAdjustment.findUnique({
      where: { id, tenantId: req.tenantId }
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot modify a completed document.' });
    }

    let totalAmount = 0;
    if (items) items.forEach(i => totalAmount += parseFloat(i.total || 0));

    const updated = await prisma.$transaction(async (tx) => {
      await tx.stockAdjustmentItem.deleteMany({
        where: { adjId: id }
      });

      const saved = await tx.stockAdjustment.update({
        where: { id },
        data: {
          date: date ? new Date(date) : existing.date,
          status: status || existing.status,
          reason: reason !== undefined ? reason : existing.reason,
          total: totalAmount,
          items: items && items.length > 0 ? {
            create: items.map(item => ({
              productId: item.productId,
              systemQty: parseFloat(item.systemQty || 0),
              actualQty: parseFloat(item.actualQty || 0),
              diffQty: parseFloat(item.diffQty || 0),
              unitPrice: parseFloat(item.unitPrice || 0),
              total: parseFloat(item.total || 0)
            }))
          } : undefined
        },
        include: {
          items: { include: { product: true } }
        }
      });

      if (saved.status === 'COMPLETED') {
        for (const item of items) {
          if (parseFloat(item.diffQty) !== 0) {
            await tx.stockMovement.create({
              data: {
                tenantId: req.tenantId,
                productId: item.productId,
                type: 'ADJ',
                quantity: parseFloat(item.diffQty),
                referenceType: 'ADJ',
                referenceId: saved.id,
                createdBy: req.user?.userId || null
              }
            });
          }
        }
      }
      return saved;
    });

    res.json(updated);
  } catch (error) {
    console.error('Failed to update ADJ:', error);
    res.status(500).json({ error: 'Failed to update Stock Adjustment' });
  }
};

const deleteStockAdjustment = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.stockAdjustment.delete({ where: { id, tenantId: req.tenantId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete Stock Adjustment' });
  }
};

const getInventoryReport = async (req, res) => {
  try {
    const { warehouseId } = req.query;

    // We get all products for the tenant
    const products = await prisma.product.findMany({
      where: { tenantId: req.tenantId },
      include: {
        category: true,
        brand: true,
        uom: true
      },
      orderBy: { name: 'asc' }
    });

    const movementWhere = { tenantId: req.tenantId };
    if (warehouseId) movementWhere.warehouseId = warehouseId;

    // We get all stock movements to calculate balances
    const movements = await prisma.stockMovement.findMany({
      where: movementWhere,
      select: {
        productId: true,
        type: true,
        quantity: true
      }
    });

    // Aggregate movements
    const stockMap = {};
    for (const m of movements) {
      if (!stockMap[m.productId]) {
        stockMap[m.productId] = 0;
      }
      const qty = parseFloat(m.quantity);
      if (m.type === 'GR' || (m.type === 'ADJ' && qty > 0)) {
        stockMap[m.productId] += Math.abs(qty);
      } else if (m.type === 'GI' || (m.type === 'ADJ' && qty < 0)) {
        stockMap[m.productId] -= Math.abs(qty);
      }
    }

    // Combine
    const report = products.map(p => {
      const currentStock = stockMap[p.id] || 0;
      const costPrice = parseFloat(p.costPrice || 0);
      const sellingPrice = parseFloat(p.sellingPrice || 0);
      
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        category: p.category?.name || '-',
        brand: p.brand?.name || '-',
        uom: p.uom?.name || '-',
        currentStock,
        costPrice,
        sellingPrice,
        totalCostValue: currentStock * costPrice,
        totalRetailValue: currentStock * sellingPrice
      };
    });

    res.json(report);
  } catch (error) {
    console.error('Failed to generate inventory report:', error);
    res.status(500).json({ error: 'Failed to generate inventory report' });
  }
};

// --- STOCK RECEIPTS ---
const getStockReceipts = async (req, res) => {
  try {
    const receipts = await prisma.stockReceipt.findMany({
      where: { tenantId: req.tenantId },
      include: {
        warehouse: true,
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(receipts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stock receipts' });
  }
};

const createStockReceipt = async (req, res) => {
  try {
    const { date, status, reason, items, warehouseId } = req.body;
    let totalAmount = 0;
    if (items) items.forEach(i => totalAmount += parseFloat(i.total || 0));

    const receiptNumber = await require('../utils/codeGenerator').generateDocumentNumber(
      req.tenantId,
      'stockReceipt',
      'SR',
      'receiptNumber'
    );

    const receipt = await prisma.$transaction(async (tx) => {
      const created = await tx.stockReceipt.create({
        data: {
          tenantId: req.tenantId,
          receiptNumber,
          date: new Date(date),
          status: status || 'DRAFT',
          reason: reason || null,
          total: totalAmount,
          warehouseId: warehouseId || null,
          createdBy: req.user?.userId || null,
          items: items && items.length > 0 ? {
            create: items.map(item => ({
              productId: item.productId,
              quantity: parseFloat(item.quantity),
              unitPrice: parseFloat(item.unitPrice || 0),
              total: parseFloat(item.total || 0)
            }))
          } : undefined
        },
        include: {
          warehouse: true,
          items: { include: { product: true } }
        }
      });

      if (created.status === 'COMPLETED' || created.status === 'ISSUED' || created.status === 'RECEIVED') {
        for (const item of items) {
          await tx.stockMovement.create({
            data: {
              tenantId: req.tenantId,
              productId: item.productId,
              type: 'GR',
              quantity: parseFloat(item.quantity),
              referenceType: 'SR',
              referenceId: created.id,
              warehouseId: warehouseId || null,
              createdBy: req.user?.userId || null
            }
          });
          await layerFromReceipt(tx, {
            tenantId: req.tenantId,
            productId: item.productId,
            warehouseId: warehouseId || null,
            quantity: item.quantity,
            unitCost: item.unitPrice,
            sourceId: created.id
          });
        }
      }
      return created;
    });

    res.status(201).json(receipt);
  } catch (error) {
    console.error('Failed to create Stock Receipt:', error);
    res.status(500).json({ error: 'Failed to create Stock Receipt' });
  }
};

const updateStockReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, status, reason, items, warehouseId } = req.body;

    const existing = await prisma.stockReceipt.findUnique({
      where: { id, tenantId: req.tenantId }
    });
    if (!existing) return res.status(404).json({ error: 'Stock Receipt not found' });
    if (existing.status === 'COMPLETED' || existing.status === 'RECEIVED') {
      return res.status(400).json({ error: 'Cannot modify a completed stock movement.' });
    }

    let totalAmount = 0;
    if (items) items.forEach(i => totalAmount += parseFloat(i.total || 0));

    const updated = await prisma.$transaction(async (tx) => {
      await tx.stockReceiptItem.deleteMany({
        where: { receiptId: id }
      });

      const saved = await tx.stockReceipt.update({
        where: { id },
        data: {
          date: date ? new Date(date) : existing.date,
          status: status || existing.status,
          reason: reason !== undefined ? reason : existing.reason,
          total: totalAmount,
          warehouseId: warehouseId !== undefined ? warehouseId : existing.warehouseId,
          items: items && items.length > 0 ? {
            create: items.map(item => ({
              productId: item.productId,
              quantity: parseFloat(item.quantity),
              unitPrice: parseFloat(item.unitPrice || 0),
              total: parseFloat(item.total || 0)
            }))
          } : undefined
        },
        include: {
          warehouse: true,
          items: { include: { product: true } }
        }
      });

      if (saved.status === 'COMPLETED' || saved.status === 'RECEIVED') {
        for (const item of items) {
          await tx.stockMovement.create({
            data: {
              tenantId: req.tenantId,
              productId: item.productId,
              type: 'GR',
              quantity: parseFloat(item.quantity),
              referenceType: 'SR',
              referenceId: saved.id,
              warehouseId: saved.warehouseId || null,
              createdBy: req.user?.userId || null
            }
          });
          await layerFromReceipt(tx, {
            tenantId: req.tenantId,
            productId: item.productId,
            warehouseId: saved.warehouseId || null,
            quantity: item.quantity,
            unitCost: item.unitPrice,
            sourceId: saved.id
          });
        }
      }
      return saved;
    });

    res.json(updated);
  } catch (error) {
    console.error('Failed to update Stock Receipt:', error);
    res.status(500).json({ error: 'Failed to update Stock Receipt' });
  }
};

const deleteStockReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.stockReceipt.delete({ where: { id, tenantId: req.tenantId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete Stock Receipt' });
  }
};

// --- STOCK TRANSFERS ---
const getStockTransfers = async (req, res) => {
  try {
    const transfers = await prisma.stockTransfer.findMany({
      where: { tenantId: req.tenantId },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(transfers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stock transfers' });
  }
};

const createStockTransfer = async (req, res) => {
  try {
    const { date, status, reason, items, fromWarehouseId, toWarehouseId } = req.body;

    const transferNumber = await require('../utils/codeGenerator').generateDocumentNumber(
      req.tenantId,
      'stockTransfer',
      'ST',
      'transferNumber'
    );

    const transfer = await prisma.$transaction(async (tx) => {
      const created = await tx.stockTransfer.create({
        data: {
          tenantId: req.tenantId,
          transferNumber,
          date: new Date(date),
          status: status || 'DRAFT',
          reason: reason || null,
          fromWarehouseId: fromWarehouseId || null,
          toWarehouseId: toWarehouseId || null,
          createdBy: req.user?.userId || null,
          items: items && items.length > 0 ? {
            create: items.map(item => ({
              productId: item.productId,
              quantity: parseFloat(item.quantity)
            }))
          } : undefined
        },
        include: {
          fromWarehouse: true,
          toWarehouse: true,
          items: { include: { product: true } }
        }
      });

      if (created.status === 'COMPLETED' || created.status === 'ISSUED' || created.status === 'RECEIVED') {
        for (const item of items) {
          await tx.stockMovement.create({
            data: {
              tenantId: req.tenantId,
              productId: item.productId,
              type: 'GI',
              quantity: parseFloat(item.quantity),
              referenceType: 'ST',
              referenceId: created.id,
              warehouseId: fromWarehouseId || null,
              createdBy: req.user?.userId || null
            }
          });
          await tx.stockMovement.create({
            data: {
              tenantId: req.tenantId,
              productId: item.productId,
              type: 'GR',
              quantity: parseFloat(item.quantity),
              referenceType: 'ST',
              referenceId: created.id,
              warehouseId: toWarehouseId || null,
              createdBy: req.user?.userId || null
            }
          });
        }
      }
      return created;
    });

    res.status(201).json(transfer);
  } catch (error) {
    console.error('Failed to create Stock Transfer:', error);
    res.status(500).json({ error: 'Failed to create Stock Transfer' });
  }
};

const updateStockTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, status, reason, items, fromWarehouseId, toWarehouseId } = req.body;

    const existing = await prisma.stockTransfer.findUnique({
      where: { id, tenantId: req.tenantId }
    });
    if (!existing) return res.status(404).json({ error: 'Stock Transfer not found' });
    if (existing.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot modify a completed stock movement.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.stockTransferItem.deleteMany({
        where: { transferId: id }
      });

      const saved = await tx.stockTransfer.update({
        where: { id },
        data: {
          date: date ? new Date(date) : existing.date,
          status: status || existing.status,
          reason: reason !== undefined ? reason : existing.reason,
          fromWarehouseId: fromWarehouseId !== undefined ? fromWarehouseId : existing.fromWarehouseId,
          toWarehouseId: toWarehouseId !== undefined ? toWarehouseId : existing.toWarehouseId,
          items: items && items.length > 0 ? {
            create: items.map(item => ({
              productId: item.productId,
              quantity: parseFloat(item.quantity)
            }))
          } : undefined
        },
        include: {
          fromWarehouse: true,
          toWarehouse: true,
          items: { include: { product: true } }
        }
      });

      if (saved.status === 'COMPLETED') {
        for (const item of items) {
          await tx.stockMovement.create({
            data: {
              tenantId: req.tenantId,
              productId: item.productId,
              type: 'GI',
              quantity: parseFloat(item.quantity),
              referenceType: 'ST',
              referenceId: saved.id,
              warehouseId: saved.fromWarehouseId || null,
              createdBy: req.user?.userId || null
            }
          });
          await tx.stockMovement.create({
            data: {
              tenantId: req.tenantId,
              productId: item.productId,
              type: 'GR',
              quantity: parseFloat(item.quantity),
              referenceType: 'ST',
              referenceId: saved.id,
              warehouseId: saved.toWarehouseId || null,
              createdBy: req.user?.userId || null
            }
          });
        }
      }
      return saved;
    });

    res.json(updated);
  } catch (error) {
    console.error('Failed to update Stock Transfer:', error);
    res.status(500).json({ error: 'Failed to update Stock Transfer' });
  }
};

const deleteStockTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.stockTransfer.delete({ where: { id, tenantId: req.tenantId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete Stock Transfer' });
  }
};

module.exports = {
  getStockLedger,
  getStockMovements,
  createStockMovement,
  deleteStockMovement,
  getGoodsIssues,
  createGoodsIssue,
  updateGoodsIssue,
  deleteGoodsIssue,
  getStockAdjustments,
  createStockAdjustment,
  updateStockAdjustment,
  deleteStockAdjustment,
  getInventoryReport,
  
  // New Stock Receipts & Transfers
  getStockReceipts,
  createStockReceipt,
  updateStockReceipt,
  deleteStockReceipt,
  getStockTransfers,
  createStockTransfer,
  updateStockTransfer,
  deleteStockTransfer
};
