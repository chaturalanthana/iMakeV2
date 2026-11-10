const prisma = require('../lib/prisma');
const path = require('path');
const fs = require('fs');

const mapProductTypeName = (name) => {
  if (!name) return 'Raw Material';
  const clean = name.toLowerCase().trim();
  if (clean.includes('raw')) return 'Raw Material';
  if (clean.includes('semi') || clean.includes('finish good') || clean.includes('sub')) return 'Sub Assembly';
  if (clean.includes('pack')) return 'Packaging Material';
  if (clean.includes('consumable') || clean.includes('spare') || clean.includes('service')) return 'Consumable';
  return 'Raw Material';
};

const getBOMs = async (req, res) => {
  try {
    const { productId } = req.query;
    const where = { tenantId: req.tenantId };
    if (productId) {
      where.productId = productId;
    }

    const boms = await prisma.bOM.findMany({
      where,
      include: {
        product: {
          select: { id: true, code: true, name: true, standardCost: true }
        }
      },
      orderBy: [
        { isDefault: 'desc' },
        { updatedAt: 'desc' }
      ]
    });
    res.json(boms);
  } catch (error) {
    console.error('Fetch BOMs error:', error);
    res.status(500).json({ error: 'Failed to fetch BOMs' });
  }
};

const getBOM = async (req, res) => {
  try {
    const { id } = req.params;
    const bom = await prisma.bOM.findFirst({
      where: { id, tenantId: req.tenantId },
      include: {
        product: {
          select: { id: true, code: true, name: true, standardCost: true }
        },
        items: {
          include: {
            componentProduct: {
              select: { 
                id: true, 
                code: true, 
                name: true, 
                standardCost: true, 
                bomApplicable: true,
                type: true,
                productType: {
                  select: { id: true, name: true }
                },
                uom: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        }
      }
    });

    if (!bom) {
      return res.status(404).json({ error: 'BOM not found' });
    }
    res.json(bom);
  } catch (error) {
    console.error('Fetch BOM error:', error);
    res.status(500).json({ error: 'Failed to fetch BOM details' });
  }
};

const getBOMByCode = async (req, res) => {
  try {
    const productCode = req.params.productCode;
    const bomCode = req.params.bomCode;
    const product = await prisma.product.findFirst({
      where: {
        tenantId: req.tenantId,
        code: { equals: productCode, mode: 'insensitive' }
      },
      select: { id: true }
    });
    if (!product) {
      return res.status(404).json({ error: 'BOM not found' });
    }

    const bom = await prisma.bOM.findFirst({
      where: {
        tenantId: req.tenantId,
        productId: product.id,
        code: { equals: bomCode, mode: 'insensitive' }
      },
      select: { id: true }
    });
    if (!bom) {
      return res.status(404).json({ error: 'BOM not found' });
    }

    req.params.id = bom.id;
    return getBOM(req, res);
  } catch (error) {
    console.error('Fetch BOM by code error:', error);
    res.status(500).json({ error: 'Failed to fetch BOM details' });
  }
};

const createBOM = async (req, res) => {
  try {
    const { productId, code, name, description, routingSteps, items, effectiveFrom, effectiveTo, version, status, isDefault } = req.body;

    // 1. Validate mandatory parent product selection
    if (!productId) {
      return res.status(400).json({ error: 'Parent product selection is required' });
    }

    const parentProduct = await prisma.product.findFirst({
      where: { id: productId, tenantId: req.tenantId }
    });

    if (!parentProduct) {
      return res.status(400).json({ error: 'Selected parent product does not exist' });
    }

    if (!parentProduct.bomApplicable) {
      return res.status(400).json({ error: 'Selected product is not configured as BOM applicable (Finished Good / Semi-Finished Good)' });
    }

    // 2. Validate component items quantity
    const componentItems = items || [];
    for (const item of componentItems) {
      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ error: 'All component quantities must be greater than zero' });
      }
    }

    // 3. Auto-assign or validate version
    let assignedVersion = '';
    if (version) {
      const existingVersion = await prisma.bOM.findFirst({
        where: {
          tenantId: req.tenantId,
          productId,
          version: { equals: version.trim(), mode: 'insensitive' }
        }
      });
      if (existingVersion) {
        return res.status(400).json({ error: `BOM version "${version.trim()}" already exists for this product` });
      }
      assignedVersion = version.trim();
    } else {
      const bomsForProduct = await prisma.bOM.findMany({
        where: { tenantId: req.tenantId, productId }
      });

      let assignedVersionNum = '1';
      if (bomsForProduct.length > 0) {
        let maxVerNum = 0;
        for (const b of bomsForProduct) {
          const numMatch = b.version.match(/\d+(\.\d+)?/);
          if (numMatch) {
            const val = parseFloat(numMatch[0]);
            if (!isNaN(val) && val > maxVerNum) {
              maxVerNum = val;
            }
          }
        }
        const nextVerNum = maxVerNum > 0 ? Math.floor(maxVerNum) + 1 : 1;
        assignedVersionNum = String(nextVerNum);
      }
      assignedVersion = assignedVersionNum;
    }

    const activeVersion = assignedVersion;
    const activeCode = code ? code.trim() : `BOM-${parentProduct.code}-${activeVersion}`;

    const existingCode = await prisma.bOM.findFirst({
      where: {
        tenantId: req.tenantId,
        productId,
        code: { equals: activeCode, mode: 'insensitive' }
      }
    });
    if (existingCode) {
      return res.status(400).json({ error: `BOM with code "${activeCode}" already exists for this product` });
    }

    // 4. Create BOM in a Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Group items by productId and update product standard costs
      const productCosts = {};
      const uniqueProductIds = [...new Set(componentItems.map(item => item.productId).filter(Boolean))];

      for (const prodId of uniqueProductIds) {
        const prod = await tx.product.findFirst({
          where: { id: prodId, tenantId: req.tenantId }
        });
        if (prod) {
          const dbCost = parseFloat(prod.standardCost || prod.costPrice || 0);
          const itemCosts = componentItems
            .filter(item => item.productId === prodId)
            .map(item => item.standardCost !== undefined ? parseFloat(item.standardCost || 0) : dbCost);
          
          const changedCost = itemCosts.find(c => c !== dbCost);
          const finalCost = changedCost !== undefined ? changedCost : dbCost;
          
          if (finalCost !== dbCost) {
            await tx.product.update({
              where: { id: prod.id },
              data: { standardCost: finalCost }
            });
          }
          productCosts[prodId] = finalCost;
        }
      }

      let totalCostSum = 0;
      for (const item of componentItems) {
        const cost = productCosts[item.productId] !== undefined ? productCosts[item.productId] : 0;
        totalCostSum += cost * parseFloat(item.quantity || 0);
      }

      const finalStatus = status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT';
      const finalDefault = finalStatus === 'ACTIVE' ? true : (isDefault !== undefined ? !!isDefault : false);

      if (finalStatus === 'ACTIVE') {
        // Retire current active BOMs for this product
        await tx.bOM.updateMany({
          where: { tenantId: req.tenantId, productId, status: 'ACTIVE' },
          data: { isDefault: false, status: 'RETIRED' }
        });
      }

      const newBom = await tx.bOM.create({
        data: {
          tenantId: req.tenantId,
          productId,
          code: activeCode,
          name: name || `BOM for ${parentProduct.name}`,
          version: activeVersion,
          status: finalStatus,
          isDefault: finalDefault,
          description,
          routingSteps: routingSteps || [],
          totalCost: totalCostSum,
          effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : (finalStatus === 'ACTIVE' ? new Date() : null),
          effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
          createdBy: req.user.userId,
          activatedAt: finalStatus === 'ACTIVE' ? new Date() : null,
          activatedBy: finalStatus === 'ACTIVE' ? req.user.userId : null,
          items: {
            create: componentItems.map(item => ({
              tenantId: req.tenantId,
              productId: item.productId,
              quantity: parseFloat(item.quantity || 0),
              scrapPercent: parseFloat(item.scrapPercent || 0),
              instruction: item.instruction || '',
              type: item.type || 'Raw Material'
            }))
          }
        },
        include: {
          items: true
        }
      });

      return newBom;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Create BOM error:', error);
    res.status(500).json({ error: 'Failed to create BOM record' });
  }
};

const updateBOM = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, version, status, isDefault, description, routingSteps, items, effectiveFrom, effectiveTo } = req.body;
    console.log("=== UPDATE BOM req.body ===", JSON.stringify({ name, code, version, status, isDefault, description, routingSteps, items, effectiveFrom, effectiveTo }, null, 2));

    const bom = await prisma.bOM.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!bom) {
      return res.status(404).json({ error: 'BOM not found' });
    }

    if (bom.status === 'ACTIVE' || bom.status === 'RETIRED') {
      return res.status(400).json({ error: 'Only DRAFT BOMs can be modified' });
    }

    // Validate component items quantity
    const componentItems = items || [];
    for (const item of componentItems) {
      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ error: 'All component quantities must be greater than zero' });
      }
    }

    const finalStatus = status === undefined ? bom.status : status;

    if (finalStatus === 'ACTIVE' && bom.status !== 'ACTIVE') {
      // 1. Validate: At least one component exists
      if (componentItems.length === 0) {
        return res.status(400).json({ error: 'At least one component must exist before activating a BOM' });
      }
    }

    // Validate code and version conflicts
    if (code && code.trim() !== bom.code) {
      const existing = await prisma.bOM.findFirst({
        where: { tenantId: req.tenantId, productId: bom.productId, code: code.trim(), NOT: { id } }
      });
      if (existing) {
        return res.status(400).json({ error: 'BOM code already exists' });
      }
    }
    if (version && version.trim() !== bom.version) {
      const existing = await prisma.bOM.findFirst({
        where: { tenantId: req.tenantId, productId: bom.productId, version: version.trim(), NOT: { id } }
      });
      if (existing) {
        return res.status(400).json({ error: 'BOM version already exists' });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Clear items
      await tx.bOMItem.deleteMany({
        where: { bomId: id }
      });

      // Clear defaults if this one is set to active and default
      const finalDefault = isDefault === undefined ? bom.isDefault : isDefault;

      // Group items by productId and update product standard costs
      const productCosts = {};
      const uniqueProductIds = [...new Set(componentItems.map(item => item.productId).filter(Boolean))];

      for (const prodId of uniqueProductIds) {
        const prod = await tx.product.findFirst({
          where: { id: prodId, tenantId: req.tenantId }
        });
        if (prod) {
          const dbCost = parseFloat(prod.standardCost || prod.costPrice || 0);
          const itemCosts = componentItems
            .filter(item => item.productId === prodId)
            .map(item => item.standardCost !== undefined ? parseFloat(item.standardCost || 0) : dbCost);
          
          const changedCost = itemCosts.find(c => c !== dbCost);
          const finalCost = changedCost !== undefined ? changedCost : dbCost;
          
          if (finalCost !== dbCost) {
            await tx.product.update({
              where: { id: prod.id },
              data: { standardCost: finalCost }
            });
          }
          productCosts[prodId] = finalCost;
        }
      }

      let totalCostSum = 0;
      for (const item of componentItems) {
        const cost = productCosts[item.productId] !== undefined ? productCosts[item.productId] : 0;
        totalCostSum += cost * parseFloat(item.quantity || 0);
      }

      let transactionData = {
        name: name !== undefined ? name : bom.name,
        code: code !== undefined ? code.trim() : bom.code,
        version: version !== undefined ? version.trim() : bom.version,
        status: finalStatus,
        isDefault: finalDefault,
        description: description !== undefined ? description : bom.description,
        routingSteps: routingSteps !== undefined ? routingSteps : bom.routingSteps,
        totalCost: totalCostSum,
        effectiveFrom: effectiveFrom !== undefined ? (effectiveFrom ? new Date(effectiveFrom) : null) : bom.effectiveFrom,
        effectiveTo: effectiveTo !== undefined ? (effectiveTo ? new Date(effectiveTo) : null) : bom.effectiveTo,
        items: {
          create: componentItems.map(item => ({
            tenantId: req.tenantId,
            productId: item.productId,
            quantity: parseFloat(item.quantity || 0),
            scrapPercent: parseFloat(item.scrapPercent || 0),
            instruction: item.instruction || '',
            type: item.type || 'Raw Material'
          }))
        }
      };

      if (finalStatus === 'ACTIVE') {
        // Retire current active BOMs for this product
        await tx.bOM.updateMany({
          where: { tenantId: req.tenantId, productId: bom.productId, status: 'ACTIVE', NOT: { id } },
          data: { isDefault: false, status: 'RETIRED' }
        });
        transactionData.isDefault = true;
        transactionData.activatedAt = new Date();
        transactionData.activatedBy = req.user.userId;
        if (!transactionData.effectiveFrom) {
          transactionData.effectiveFrom = new Date();
        }
      }

      const updated = await tx.bOM.update({
        where: { id },
        data: transactionData,
        include: {
          items: true
        }
      });
      return updated;
    });

    res.json(result);
  } catch (error) {
    console.error('Update BOM error:', error);
    res.status(500).json({ error: 'Failed to update BOM record' });
  }
};

const deleteBOM = async (req, res) => {
  try {
    const { id } = req.params;
    const bom = await prisma.bOM.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!bom) {
      return res.status(404).json({ error: 'BOM not found' });
    }

    if (bom.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Only BOMs in DRAFT status can be deleted' });
    }

    await prisma.bOM.delete({
      where: { id }
    });

    res.json({ message: 'BOM deleted successfully' });
  } catch (error) {
    console.error('Delete BOM error:', error);
    res.status(500).json({ error: 'Failed to delete BOM' });
  }
};

const activateBOM = async (req, res) => {
  try {
    const { id } = req.params;

    const bom = await prisma.bOM.findFirst({
      where: { id, tenantId: req.tenantId },
      include: { items: true }
    });
    if (!bom) {
      return res.status(404).json({ error: 'BOM not found' });
    }

    // 1. Validate: Finished Good is assigned
    if (!bom.productId) {
      return res.status(400).json({ error: 'Finished Good must be assigned before activation' });
    }

    // 2. Validate: At least one component exists
    if (!bom.items || bom.items.length === 0) {
      return res.status(400).json({ error: 'At least one component must exist before activating a BOM' });
    }

    // 3. Validate: All component quantities are greater than zero
    for (const item of bom.items) {
      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ error: 'All component quantities must be greater than zero' });
      }
    }

    // 6. Perform Activation inside a Transaction
    await prisma.$transaction(async (tx) => {
      // Retire current active BOMs for this product
      await tx.bOM.updateMany({
        where: { tenantId: req.tenantId, productId: bom.productId, status: 'ACTIVE', NOT: { id } },
        data: { isDefault: false, status: 'RETIRED' }
      });

      // Activate this one
      await tx.bOM.update({
        where: { id },
        data: { 
          isDefault: true, 
          status: 'ACTIVE',
          effectiveFrom: bom.effectiveFrom || new Date(),
          activatedAt: new Date(),
          activatedBy: req.user.userId
        }
      });
    });

    res.json({ message: 'BOM activated successfully and set as default' });
  } catch (error) {
    console.error('Activate BOM error:', error);
    res.status(500).json({ error: 'Failed to activate BOM' });
  }
};

const retireBOM = async (req, res) => {
  try {
    const { id } = req.params;
    const { confirmRetire } = req.body;

    const bom = await prisma.bOM.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!bom) {
      return res.status(404).json({ error: 'BOM not found' });
    }

    if (bom.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Only ACTIVE BOMs can be retired' });
    }

    // Check if other active BOM exists for this Finished Good
    const otherActive = await prisma.bOM.findFirst({
      where: {
        tenantId: req.tenantId,
        productId: bom.productId,
        status: 'ACTIVE',
        NOT: { id }
      }
    });

    if (!otherActive && !confirmRetire) {
      return res.json({
        warning: 'NO_OTHER_ACTIVE_BOM',
        message: 'Warning: Retiring this BOM will leave the product with no active BOM. Do you want to proceed?'
      });
    }

    // Proceed to retire
    await prisma.bOM.update({
      where: { id },
      data: {
        status: 'RETIRED',
        isDefault: false
      }
    });

    res.json({ message: 'BOM retired successfully' });
  } catch (error) {
    console.error('Retire BOM error:', error);
    res.status(500).json({ error: 'Failed to retire BOM' });
  }
};

const compareBOMs = async (req, res) => {
  try {
    const { bom1: bom1Id, bom2: bom2Id } = req.query;

    if (!bom1Id || !bom2Id) {
      return res.status(400).json({ error: 'Both bom1 and bom2 IDs are required as query parameters' });
    }

    const [bom1, bom2] = await Promise.all([
      prisma.bOM.findFirst({
        where: { id: bom1Id, tenantId: req.tenantId },
        include: {
          items: {
            include: {
              componentProduct: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  type: true,
                  productType: { select: { name: true } },
                  uom: { select: { name: true } }
                }
              }
            }
          },
          product: {
            select: {
              id: true,
              code: true,
              name: true
            }
          }
        }
      }),
      prisma.bOM.findFirst({
        where: { id: bom2Id, tenantId: req.tenantId },
        include: {
          items: {
            include: {
              componentProduct: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  type: true,
                  productType: { select: { name: true } },
                  uom: { select: { name: true } }
                }
              }
            }
          },
          product: {
            select: {
              id: true,
              code: true,
              name: true
            }
          }
        }
      })
    ]);

    if (!bom1 || !bom2) {
      return res.status(404).json({ error: 'One or both of the selected BOMs could not be found' });
    }

    if (bom1.productId !== bom2.productId) {
      return res.status(400).json({ error: 'Cannot compare BOMs belonging to different finished goods' });
    }

    // 1. Process component items diff
    const itemsMap1 = new Map(bom1.items.map(item => [item.productId, item]));
    const itemsMap2 = new Map(bom2.items.map(item => [item.productId, item]));

    const allProductIds = new Set([
      ...bom1.items.map(item => item.productId),
      ...bom2.items.map(item => item.productId)
    ]);

    const componentsDiff = [];

    for (const prodId of allProductIds) {
      const item1 = itemsMap1.get(prodId);
      const item2 = itemsMap2.get(prodId);

      const compProduct = (item2 || item1).componentProduct;
      const code = compProduct?.code || '';
      const name = compProduct?.name || '';
      const uom = compProduct?.uom?.name || '-';

      let changeType = 'unchanged';
      const changedFields = [];

      const val1 = item1 ? {
        quantity: parseFloat(item1.quantity),
        scrapPercent: parseFloat(item1.scrapPercent),
        instruction: item1.instruction || '',
        type: mapProductTypeName(item1.componentProduct?.productType?.name)
      } : null;

      const val2 = item2 ? {
        quantity: parseFloat(item2.quantity),
        scrapPercent: parseFloat(item2.scrapPercent),
        instruction: item2.instruction || '',
        type: mapProductTypeName(item2.componentProduct?.productType?.name)
      } : null;

      if (item1 && !item2) {
        changeType = 'removed';
      } else if (!item1 && item2) {
        changeType = 'added';
      } else {
        // Both exist
        if (val1.quantity !== val2.quantity) {
          changedFields.push('quantity');
        }
        if (val1.scrapPercent !== val2.scrapPercent) {
          changedFields.push('scrapPercent');
        }
        if (val1.instruction !== val2.instruction) {
          changedFields.push('instruction');
        }
        if (val1.type !== val2.type) {
          changedFields.push('type');
        }

        if (changedFields.length > 0) {
          changeType = 'modified';
        }
      }

      componentsDiff.push({
        productId: prodId,
        code,
        name,
        uom,
        type: mapProductTypeName(compProduct?.productType?.name),
        changeType,
        bom1Val: val1,
        bom2Val: val2,
        changedFields
      });
    }

    // 2. Process routing steps diff
    const routingSteps1 = Array.isArray(bom1.routingSteps) ? bom1.routingSteps : [];
    const routingSteps2 = Array.isArray(bom2.routingSteps) ? bom2.routingSteps : [];

    const stepsMap1 = new Map(routingSteps1.map(step => [step.stepNumber, step]));
    const stepsMap2 = new Map(routingSteps2.map(step => [step.stepNumber, step]));

    const allStepNumbers = Array.from(new Set([
      ...routingSteps1.map(step => step.stepNumber),
      ...routingSteps2.map(step => step.stepNumber)
    ])).sort((a, b) => a - b);

    const routingDiff = [];

    for (const stepNum of allStepNumbers) {
      const step1 = stepsMap1.get(stepNum);
      const step2 = stepsMap2.get(stepNum);

      let changeType = 'unchanged';
      const changedFields = [];

      const val1 = step1 ? {
        operation: step1.operation || '',
        workCenter: step1.workCenter || '',
        durationMinutes: parseInt(step1.durationMinutes) || 0
      } : null;

      const val2 = step2 ? {
        operation: step2.operation || '',
        workCenter: step2.workCenter || '',
        durationMinutes: parseInt(step2.durationMinutes) || 0
      } : null;

      if (step1 && !step2) {
        changeType = 'removed';
      } else if (!step1 && step2) {
        changeType = 'added';
      } else {
        if (val1.operation !== val2.operation) {
          changedFields.push('operation');
        }
        if (val1.workCenter !== val2.workCenter) {
          changedFields.push('workCenter');
        }
        if (val1.durationMinutes !== val2.durationMinutes) {
          changedFields.push('durationMinutes');
        }

        if (changedFields.length > 0) {
          changeType = 'modified';
        }
      }

      routingDiff.push({
        stepNumber: stepNum,
        changeType,
        bom1Val: val1,
        bom2Val: val2,
        changedFields
      });
    }

    res.json({
      bom1: {
        id: bom1.id,
        code: bom1.code,
        version: bom1.version,
        status: bom1.status,
        totalCost: parseFloat(bom1.totalCost),
        effectiveFrom: bom1.effectiveFrom,
        effectiveTo: bom1.effectiveTo
      },
      bom2: {
        id: bom2.id,
        code: bom2.code,
        version: bom2.version,
        status: bom2.status,
        totalCost: parseFloat(bom2.totalCost),
        effectiveFrom: bom2.effectiveFrom,
        effectiveTo: bom2.effectiveTo
      },
      product: bom1.product,
      componentsDiff,
      routingDiff
    });
  } catch (error) {
    console.error('Compare BOMs error:', error);
    res.status(500).json({ error: 'Failed to compare BOM versions' });
  }
};

// Recursive resolver for multi-level BOM Tree
const getBOMTree = async (req, res) => {
  try {
    const { productId } = req.params;
    const visited = new Set();

    const resolveNode = async (prodId, reqQty = 1) => {
      if (visited.has(prodId)) {
        // Handle circular dependency gracefully
        return {
          productId: prodId,
          error: 'Circular dependency detected'
        };
      }

      visited.add(prodId);

      const product = await prisma.product.findFirst({
        where: { id: prodId, tenantId: req.tenantId },
        select: { 
          id: true, 
          code: true, 
          name: true, 
          standardCost: true, 
          bomApplicable: true,
          productType: {
            select: { id: true, name: true }
          },
          uom: {
            select: { id: true, name: true }
          }
        }
      });

      if (!product) return null;

      const node = {
        productId: product.id,
        code: product.code,
        name: product.name,
        quantity: reqQty,
        bomApplicable: product.bomApplicable || false,
        standardCost: parseFloat(product.standardCost || 0),
        totalCost: parseFloat(product.standardCost || 0) * reqQty,
        uom: product.uom?.name || '-',
        type: mapProductTypeName(product.productType?.name),
        children: []
      };

      // If BOM applicable, find default active BOM
      if (product.bomApplicable) {
        const activeBOM = await prisma.bOM.findFirst({
          where: {
            tenantId: req.tenantId,
            productId: product.id,
            status: 'ACTIVE',
            isDefault: true
          },
          include: {
            items: {
              include: {
                componentProduct: {
                  select: { 
                    id: true, 
                    code: true, 
                    name: true, 
                    standardCost: true, 
                    bomApplicable: true,
                    type: true,
                    uom: {
                      select: { id: true, name: true }
                    }
                  }
                }
              }
            }
          }
        });

        if (activeBOM) {
          node.bomCode = activeBOM.code;
          node.bomVersion = activeBOM.version;
          node.bomName = activeBOM.name;

          for (const item of activeBOM.items) {
            const childQty = parseFloat(item.quantity) * reqQty;
            const childNode = await resolveNode(item.productId, childQty);
            if (childNode) {
              childNode.scrapPercent = parseFloat(item.scrapPercent || 0);
              childNode.instruction = item.instruction || '';
              node.children.push(childNode);
            }
          }
          // Rolled up cost calculation
          node.totalCost = node.children.reduce((sum, child) => sum + child.totalCost, 0);
        }
      }

      visited.delete(prodId);
      return node;
    };

    const tree = await resolveNode(productId);
    if (!tree) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(tree);
  } catch (error) {
    console.error('Resolve BOM Tree error:', error);
    res.status(500).json({ error: 'Failed to resolve BOM tree' });
  }
};

const getBOMResources = async (req, res) => {
  try {
    const { id } = req.params;
    const resources = await prisma.bOMResource.findMany({
      where: { bomId: id, tenantId: req.tenantId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(resources);
  } catch (error) {
    console.error('Fetch resources error:', error);
    res.status(500).json({ error: 'Failed to fetch BOM resources' });
  }
};

const uploadBOMResource = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: 'No file was uploaded' });
    }

    const fileType = path.extname(req.file.originalname).toLowerCase().replace('.', '');
    
    const resource = await prisma.bOMResource.create({
      data: {
        tenantId: req.tenantId,
        bomId: id,
        fileName: req.file.originalname,
        filePath: `/uploads/boms/${id}/${req.file.filename}`,
        fileType: fileType,
        fileSize: req.file.size
      }
    });
    res.status(201).json(resource);
  } catch (error) {
    console.error('Upload resource error:', error);
    res.status(500).json({ error: 'Failed to save resource record' });
  }
};

const deleteBOMResource = async (req, res) => {
  try {
    const { id, resourceId } = req.params;
    const resource = await prisma.bOMResource.findFirst({
      where: { id: resourceId, bomId: id, tenantId: req.tenantId }
    });
    
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    await prisma.bOMResource.delete({
      where: { id: resourceId }
    });

    const fullPath = path.join(__dirname, '../../', resource.filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    res.json({ message: 'Resource deleted successfully' });
  } catch (error) {
    console.error('Delete resource error:', error);
    res.status(500).json({ error: 'Failed to delete resource' });
  }
};

const duplicateBOM = async (req, res) => {
  try {
    const { id } = req.params;
    const originalBom = await prisma.bOM.findFirst({
      where: { id, tenantId: req.tenantId },
      include: {
        items: true,
        resources: true
      }
    });

    if (!originalBom) {
      return res.status(404).json({ error: 'BOM to duplicate not found' });
    }

    // Generate unique version (numeric increment, no postfixes)
    const allBomsForProduct = await prisma.bOM.findMany({
      where: {
        tenantId: req.tenantId,
        productId: originalBom.productId
      },
      select: { version: true }
    });

    let maxVerNum = 0;
    for (const b of allBomsForProduct) {
      const numMatch = b.version.match(/\d+(\.\d+)?/);
      if (numMatch) {
        const val = parseFloat(numMatch[0]);
        if (!isNaN(val) && val > maxVerNum) {
          maxVerNum = val;
        }
      }
    }
    
    const nextVerNum = maxVerNum > 0 ? Math.floor(maxVerNum) + 1 : 1;
    let newVersion = String(nextVerNum);

    // Verify version uniqueness fallback
    let attempts = 0;
    let baseVerNum = nextVerNum;
    while (attempts < 100) {
      const activeVer = String(baseVerNum);
      const existing = await prisma.bOM.findFirst({
        where: {
          tenantId: req.tenantId,
          productId: originalBom.productId,
          version: { equals: activeVer, mode: 'insensitive' }
        }
      });
      if (!existing) {
        newVersion = activeVer;
        break;
      }
      baseVerNum++;
      attempts++;
    }

    // Generate suggested BOM Code based on parent product and the new numeric version
    const parentProduct = await prisma.product.findFirst({
      where: { id: originalBom.productId, tenantId: req.tenantId }
    });
    const parentCode = parentProduct ? parentProduct.code : 'PROD';
    let newCode = `BOM-${parentCode}-${newVersion}`.toUpperCase();

    // Verify code uniqueness fallback
    attempts = 0;
    let baseCode = newCode;
    while (attempts < 100) {
      const activeCode = attempts === 0 ? baseCode : `${baseCode}-${attempts}`;
      const existing = await prisma.bOM.findFirst({
        where: {
          tenantId: req.tenantId,
          productId: originalBom.productId,
          code: { equals: activeCode, mode: 'insensitive' }
        }
      });
      if (!existing) {
        newCode = activeCode;
        break;
      }
      attempts++;
    }

    // Start database transaction
    const duplicatedBOM = await prisma.$transaction(async (tx) => {
      // 1. Create duplicated BOM
      const newBom = await tx.bOM.create({
        data: {
          tenantId: req.tenantId,
          productId: originalBom.productId,
          code: newCode,
          name: `${originalBom.name} (Copy)`,
          version: newVersion,
          status: 'DRAFT', // Always duplicate as DRAFT
          isDefault: false, // Never default immediately
          description: originalBom.description,
          routingSteps: originalBom.routingSteps || [],
          totalCost: originalBom.totalCost,
          effectiveFrom: originalBom.effectiveFrom,
          effectiveTo: originalBom.effectiveTo,
          createdBy: req.user.userId,
          items: {
            create: originalBom.items.map(item => ({
              tenantId: req.tenantId,
              productId: item.productId,
              quantity: item.quantity,
              scrapPercent: item.scrapPercent,
              instruction: item.instruction || '',
              type: item.type || 'Raw Material'
            }))
          }
        }
      });

      // 2. Duplicate Resources in DB & disk
      const uploadsDir = path.join(__dirname, '../../uploads/boms', newBom.id);
      
      if (originalBom.resources.length > 0) {
        // Ensure destination folder exists
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        for (const resource of originalBom.resources) {
          const srcPath = path.join(__dirname, '../../', resource.filePath);
          if (fs.existsSync(srcPath)) {
            // Generate a safe unique name inside the new folder to prevent overlap
            const fileExt = path.extname(resource.fileName);
            const baseName = path.basename(resource.fileName, fileExt);
            const newFileName = `${baseName}_${Date.now()}${fileExt}`;
            const destPath = path.join(uploadsDir, newFileName);

            // Copy file physically
            fs.copyFileSync(srcPath, destPath);

            // Create record
            await tx.bOMResource.create({
              data: {
                tenantId: req.tenantId,
                bomId: newBom.id,
                fileName: resource.fileName,
                filePath: `/uploads/boms/${newBom.id}/${newFileName}`,
                fileType: resource.fileType,
                fileSize: resource.fileSize
              }
            });
          }
        }
      }

      return newBom;
    });

    res.status(201).json(duplicatedBOM);
  } catch (error) {
    console.error('Duplicate BOM error:', error);
    res.status(500).json({ error: 'Failed to duplicate BOM' });
  }
};

module.exports = {
  getBOMs,
  getBOM,
  getBOMByCode,
  createBOM,
  updateBOM,
  deleteBOM,
  activateBOM,
  retireBOM,
  compareBOMs,
  getBOMTree,
  getBOMResources,
  uploadBOMResource,
  deleteBOMResource,
  duplicateBOM
};
