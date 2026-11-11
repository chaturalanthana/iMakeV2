const prisma = require('../lib/prisma');
const { respondList } = require('../services/listQuery');
const { writeAudit } = require('../services/auditService');

const getProducts = async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.query.categoryId) where.categoryId = req.query.categoryId;
    if (req.query.brand) where.brand = { name: String(req.query.brand) };
    await respondList(req, res, {
      model: prisma.product,
      where,
      include: {
        category: true,
        brand: true,
        uom: true,
        stockUom: true,
        purchaseUom: true,
        salesUom: true,
        productType: true,
        supplier: true,
        inventoryAccount: true,
        cogsAccount: true,
        currencyRel: true,
        productGroupRel: true
      },
      search: ['code', 'name'],
      sortFields: ['code', 'name', 'createdAt', 'sellingPrice', 'costPrice'],
      defaultSort: 'createdAt',
      filename: 'items.xlsx',
      exportHeaders: ['code', 'name', 'sellingPrice', 'costPrice', 'activeStatus'],
      toExport: (row) => ({
        code: row.code,
        name: row.name,
        sellingPrice: String(row.sellingPrice ?? ''),
        costPrice: String(row.costPrice ?? ''),
        activeStatus: row.activeStatus || ''
      })
    });
  } catch (error) {
    console.error('Fetch products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

const getCategoryPath = (cat, allCategories) => {
  let path = cat.name;
  let currentParentId = cat.parentId;
  while (currentParentId) {
    const parent = allCategories.find(c => c.id === currentParentId);
    if (!parent) break;
    path = `${parent.name} > ${path}`;
    currentParentId = parent.parentId;
  }
  return path;
};

const getBrandPath = (brand, allBrands) => {
  let path = brand.name;
  let currentParentId = brand.parentId;
  while (currentParentId) {
    const parent = allBrands.find(b => b.id === currentParentId);
    if (!parent) break;
    path = `${parent.name} > ${path}`;
    currentParentId = parent.parentId;
  }
  return path;
};

const getProductGroupPath = (group, allGroups) => {
  let path = group.name;
  let currentParentId = group.parentId;
  while (currentParentId) {
    const parent = allGroups.find(g => g.id === currentParentId);
    if (!parent) break;
    path = `${parent.name} > ${path}`;
    currentParentId = parent.parentId;
  }
  return path;
};

const getAttributes = async (req, res) => {
  try {
    const [allCategories, brands, uoms, productTypes, suppliers, accounts, currencies, productGroups] = await Promise.all([
      prisma.productCategory.findMany({ 
        where: { tenantId: req.tenantId },
        select: { id: true, name: true, parentId: true }
      }),
      prisma.productBrand.findMany({ 
        where: { tenantId: req.tenantId }, 
        select: { id: true, name: true, parentId: true } 
      }),
      prisma.unitOfMeasure.findMany({ where: { tenantId: req.tenantId }, select: { id: true, name: true } }),
      prisma.productType.findMany({ where: { tenantId: req.tenantId }, select: { id: true, name: true } }),
      prisma.supplier.findMany({ where: { tenantId: req.tenantId }, select: { id: true, name: true } }),
      prisma.account.findMany({ 
        where: { tenantId: req.tenantId }, 
        select: { id: true, name: true, code: true, type: true } 
      }),
      prisma.currency.findMany({
        where: { tenantId: req.tenantId },
        select: { id: true, code: true, name: true, symbol: true }
      }),
      prisma.productGroup.findMany({
        where: { tenantId: req.tenantId },
        select: { id: true, name: true, parentId: true }
      })
    ]);
    
    // Construct hierarchy labels for categories
    const categoriesMapped = allCategories.map(cat => ({
      label: getCategoryPath(cat, allCategories),
      value: cat.id
    })).sort((a, b) => a.label.localeCompare(b.label));

    // Construct hierarchy labels for brands
    const brandsMapped = brands.map(b => ({
      label: getBrandPath(b, brands),
      value: b.id
    })).sort((a, b) => a.label.localeCompare(b.label));

    // Construct hierarchy labels for product groups
    const productGroupsMapped = productGroups.map(pg => ({
      label: getProductGroupPath(pg, productGroups),
      value: pg.id
    })).sort((a, b) => a.label.localeCompare(b.label));

    res.json({ 
      categories: categoriesMapped, 
      brands: brandsMapped, 
      productGroups: productGroupsMapped,
      uoms: uoms.map(u => ({ label: u.name, value: u.id })),
      productTypes: productTypes.map(p => ({ label: p.name, value: p.id })),
      suppliers: suppliers.map(s => ({ label: s.name, value: s.id })),
      accounts: accounts.map(a => ({ 
        label: `${a.code} - ${a.name}`, 
        value: a.id, 
        code: a.code,
        name: a.name,
        type: a.type 
      })),
      currencies: currencies.map(c => ({
        label: `${c.code} - ${c.name}`,
        value: c.id,
        code: c.code,
        symbol: c.symbol
      }))
    });
  } catch (error) {
    console.error('Fetch attributes error:', error);
    res.status(500).json({ error: 'Failed to fetch product attributes' });
  }
};

const createProduct = async (req, res) => {
  try {
    const { 
      code, name, description, type, costPrice, sellingPrice, 
      categoryId, categoryName, brandId, productTypeId,
      subCategoryId, supplierId, hsCode, cpg, currency, currencyId, reorderLevel, isLocked,
      stockUomId, purchaseUomId, salesUomId, conversionFactor, costingMethod,
      bomApplicable, activeStatus, standardCost, scrapPercent, safetyStock,
      taxGroup, inventoryAccountId, cogsAccountId, productGroup, productGroupId, uomConversions
    } = req.body;
    
    // 1. Mandatory Parameters Validation
    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Product code is required' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    // 2. Duplicate Code check
    const existingCode = await prisma.product.findFirst({
      where: {
        tenantId: req.tenantId,
        code: {
          equals: code.trim(),
          mode: 'insensitive'
        }
      }
    });
    if (existingCode) {
      return res.status(400).json({ error: 'Product code already exists' });
    }

    // 3. Status and Enum Validation
    if (type && !['PRODUCT', 'SERVICE'].includes(type)) {
      return res.status(400).json({ error: 'Invalid product type. Must be PRODUCT or SERVICE' });
    }
    if (costingMethod && !['FIFO'].includes(costingMethod)) {
      return res.status(400).json({ error: 'Invalid costing method' });
    }
    if (activeStatus && !['ACTIVE', 'INACTIVE'].includes(activeStatus)) {
      return res.status(400).json({ error: 'Invalid active status. Must be ACTIVE or INACTIVE' });
    }

    // 4. Unrealistic/Negative numeric entries
    const parsedCostPrice = parseFloat(costPrice);
    if (costPrice !== undefined && (isNaN(parsedCostPrice) || parsedCostPrice < 0)) {
      return res.status(400).json({ error: 'Cost price cannot be negative' });
    }
    const parsedSellingPrice = parseFloat(sellingPrice);
    if (sellingPrice !== undefined && (isNaN(parsedSellingPrice) || parsedSellingPrice < 0)) {
      return res.status(400).json({ error: 'Selling price cannot be negative' });
    }
    const parsedStandardCost = parseFloat(standardCost);
    if (standardCost !== undefined && (isNaN(parsedStandardCost) || parsedStandardCost < 0)) {
      return res.status(400).json({ error: 'Standard cost cannot be negative' });
    }
    const parsedScrapPercent = parseFloat(scrapPercent);
    if (scrapPercent !== undefined && (isNaN(parsedScrapPercent) || parsedScrapPercent < 0 || parsedScrapPercent > 100)) {
      return res.status(400).json({ error: 'Scrap percentage must be between 0 and 100' });
    }
    const parsedReorderLevel = parseInt(reorderLevel);
    if (reorderLevel !== undefined && (isNaN(parsedReorderLevel) || parsedReorderLevel < 0)) {
      return res.status(400).json({ error: 'Reorder level cannot be negative' });
    }
    const parsedSafetyStock = parseInt(safetyStock);
    if (safetyStock !== undefined && (isNaN(parsedSafetyStock) || parsedSafetyStock < 0)) {
      return res.status(400).json({ error: 'Safety stock cannot be negative' });
    }

    // UOM Conversion Validations
    let parsedConversionFactor = parseFloat(conversionFactor);
    if (!isNaN(parsedConversionFactor) && parsedConversionFactor <= 0) {
      return res.status(400).json({ error: 'Conversion factor must be greater than zero' });
    }
    if (stockUomId && purchaseUomId && stockUomId === purchaseUomId && parsedConversionFactor !== 1.0) {
      return res.status(400).json({ error: 'Conversion factor must be 1 when Stock and Purchase UOM are the same' });
    }
    if (Array.isArray(uomConversions)) {
      for (const conv of uomConversions) {
        if (parseFloat(conv.factor) <= 0) {
          return res.status(400).json({ error: 'UOM conversion factors must be perfectly matched (greater than zero)' });
        }
      }
    }

    // 5. Zero-Trust Tenant Isolation Verification for related entities
    if (categoryId) {
      const cat = await prisma.productCategory.findFirst({ where: { id: categoryId, tenantId: req.tenantId } });
      if (!cat) return res.status(400).json({ error: 'Invalid Category ID' });
    }
    if (brandId) {
      const brand = await prisma.productBrand.findFirst({ where: { id: brandId, tenantId: req.tenantId } });
      if (!brand) return res.status(400).json({ error: 'Invalid Brand ID' });
    }
    if (supplierId) {
      const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId: req.tenantId } });
      if (!supplier) return res.status(400).json({ error: 'Invalid Supplier ID' });
    }
    if (stockUomId) {
      const uom = await prisma.unitOfMeasure.findFirst({ where: { id: stockUomId, tenantId: req.tenantId } });
      if (!uom) return res.status(400).json({ error: 'Invalid Stock UOM ID' });
    }
    if (purchaseUomId) {
      const uom = await prisma.unitOfMeasure.findFirst({ where: { id: purchaseUomId, tenantId: req.tenantId } });
      if (!uom) return res.status(400).json({ error: 'Invalid Purchase UOM ID' });
    }
    if (salesUomId) {
      const uom = await prisma.unitOfMeasure.findFirst({ where: { id: salesUomId, tenantId: req.tenantId } });
      if (!uom) return res.status(400).json({ error: 'Invalid Sales UOM ID' });
    }
    if (inventoryAccountId) {
      const acc = await prisma.account.findFirst({ where: { id: inventoryAccountId, tenantId: req.tenantId } });
      if (!acc) return res.status(400).json({ error: 'Invalid Inventory Account ID' });
    }
    if (cogsAccountId) {
      const acc = await prisma.account.findFirst({ where: { id: cogsAccountId, tenantId: req.tenantId } });
      if (!acc) return res.status(400).json({ error: 'Invalid COGS Account ID' });
    }
    if (productGroupId) {
      const pg = await prisma.productGroup.findFirst({ where: { id: productGroupId, tenantId: req.tenantId } });
      if (!pg) return res.status(400).json({ error: 'Invalid Product Group ID' });
    }

    let resolvedCategoryId = categoryId || null;

    if (!resolvedCategoryId && categoryName) {
      let cat = await prisma.productCategory.findFirst({
        where: { tenantId: req.tenantId, name: categoryName }
      });
      if (!cat) {
        cat = await prisma.productCategory.create({
          data: { tenantId: req.tenantId, name: categoryName }
        });
      }
      resolvedCategoryId = cat.id;
    }

    let resolvedCurrency = currency || 'USD';
    if (currencyId) {
      const dbCurrency = await prisma.currency.findUnique({ where: { id: currencyId } });
      if (dbCurrency) resolvedCurrency = dbCurrency.code;
    }

    const newProduct = await prisma.product.create({
      data: {
        tenantId: req.tenantId,
        code,
        name,
        description,
        type: type || 'PRODUCT',
        costPrice: parseFloat(costPrice) || 0,
        sellingPrice: parseFloat(sellingPrice) || 0,
        categoryId: resolvedCategoryId,
        subCategoryId: subCategoryId || null,
        brandId: brandId || null,
        supplierId: supplierId || null,
        productTypeId: productTypeId || null,
        hsCode: hsCode || null,
        cpg: cpg || null,
        currency: resolvedCurrency,
        currencyId: currencyId || null,
        reorderLevel: parseInt(reorderLevel) || 0,
        isLocked: isLocked === true || isLocked === 'true',
        
        // New Parameters
        stockUomId: stockUomId || null,
        purchaseUomId: purchaseUomId || null,
        salesUomId: salesUomId || null,
        conversionFactor: parseFloat(conversionFactor) || 1.0,
        uomConversions: uomConversions || [],
        costingMethod: costingMethod || 'FIFO',
        bomApplicable: bomApplicable === true || bomApplicable === 'true',
        activeStatus: activeStatus || 'ACTIVE',
        standardCost: parseFloat(standardCost) || 0,
        scrapPercent: parseFloat(scrapPercent) || 0,
        safetyStock: parseInt(safetyStock) || 0,
        taxGroup: taxGroup || null,
        inventoryAccountId: inventoryAccountId || null,
        cogsAccountId: cogsAccountId || null,
        productGroupId: productGroupId || null,
        productGroup: productGroup || null,
        
        createdBy: req.user.userId
      },
      include: { 
        category: true, 
        brand: true, 
        stockUom: true, 
        purchaseUom: true, 
        salesUom: true, 
        productType: true, 
        supplier: true,
        inventoryAccount: true,
        cogsAccount: true,
        currencyRel: true,
        productGroupRel: true
      }
    });

    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      code, name, description, type, costPrice, sellingPrice, 
      categoryId, categoryName, brandId, productTypeId,
      subCategoryId, supplierId, hsCode, cpg, currency, currencyId, reorderLevel, isLocked,
      stockUomId, purchaseUomId, salesUomId, conversionFactor, costingMethod,
      bomApplicable, activeStatus, standardCost, scrapPercent, safetyStock,
      taxGroup, inventoryAccountId, cogsAccountId, productGroup, productGroupId, uomConversions
    } = req.body;

    // Verify product ownership
    const product = await prisma.product.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (code !== undefined) {
      if (!code || !code.trim()) {
        return res.status(400).json({ error: 'Product code is required' });
      }
      const existingCode = await prisma.product.findFirst({
        where: {
          tenantId: req.tenantId,
          code: {
            equals: code.trim(),
            mode: 'insensitive'
          },
          NOT: { id }
        }
      });
      if (existingCode) {
        return res.status(400).json({ error: 'Product code already exists' });
      }
    }

    if (name !== undefined && (!name || !name.trim())) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    if (type !== undefined && !['PRODUCT', 'SERVICE'].includes(type)) {
      return res.status(400).json({ error: 'Invalid product type. Must be PRODUCT or SERVICE' });
    }
    if (costingMethod !== undefined && !['FIFO'].includes(costingMethod)) {
      return res.status(400).json({ error: 'Invalid costing method' });
    }
    if (activeStatus !== undefined && !['ACTIVE', 'INACTIVE'].includes(activeStatus)) {
      return res.status(400).json({ error: 'Invalid active status. Must be ACTIVE or INACTIVE' });
    }

    if (costPrice !== undefined) {
      const parsedCostPrice = parseFloat(costPrice);
      if (isNaN(parsedCostPrice) || parsedCostPrice < 0) {
        return res.status(400).json({ error: 'Cost price cannot be negative' });
      }
    }
    if (sellingPrice !== undefined) {
      const parsedSellingPrice = parseFloat(sellingPrice);
      if (isNaN(parsedSellingPrice) || parsedSellingPrice < 0) {
        return res.status(400).json({ error: 'Selling price cannot be negative' });
      }
    }
    if (standardCost !== undefined) {
      const parsedStandardCost = parseFloat(standardCost);
      if (isNaN(parsedStandardCost) || parsedStandardCost < 0) {
        return res.status(400).json({ error: 'Standard cost cannot be negative' });
      }
    }
    if (scrapPercent !== undefined) {
      const parsedScrapPercent = parseFloat(scrapPercent);
      if (isNaN(parsedScrapPercent) || parsedScrapPercent < 0 || parsedScrapPercent > 100) {
        return res.status(400).json({ error: 'Scrap percentage must be between 0 and 100' });
      }
    }
    if (reorderLevel !== undefined) {
      const parsedReorderLevel = parseInt(reorderLevel);
      if (isNaN(parsedReorderLevel) || parsedReorderLevel < 0) {
        return res.status(400).json({ error: 'Reorder level cannot be negative' });
      }
    }
    if (safetyStock !== undefined) {
      const parsedSafetyStock = parseInt(safetyStock);
      if (isNaN(parsedSafetyStock) || parsedSafetyStock < 0) {
        return res.status(400).json({ error: 'Safety stock cannot be negative' });
      }
    }

    // UOM Conversion Validations
    if (conversionFactor !== undefined) {
      let parsedConversionFactor = parseFloat(conversionFactor);
      if (!isNaN(parsedConversionFactor) && parsedConversionFactor <= 0) {
        return res.status(400).json({ error: 'Conversion factor must be greater than zero' });
      }
      if (stockUomId && purchaseUomId && stockUomId === purchaseUomId && parsedConversionFactor !== 1.0) {
        return res.status(400).json({ error: 'Conversion factor must be 1 when Stock and Purchase UOM are the same' });
      }
    }
    
    if (Array.isArray(uomConversions)) {
      for (const conv of uomConversions) {
        if (parseFloat(conv.factor) <= 0) {
          return res.status(400).json({ error: 'UOM conversion factors must be perfectly matched (greater than zero)' });
        }
      }
    }

    // Zero-Trust Tenant Isolation Verification for related entities
    if (categoryId) {
      const cat = await prisma.productCategory.findFirst({ where: { id: categoryId, tenantId: req.tenantId } });
      if (!cat) return res.status(400).json({ error: 'Invalid Category ID' });
    }
    if (brandId) {
      const brand = await prisma.productBrand.findFirst({ where: { id: brandId, tenantId: req.tenantId } });
      if (!brand) return res.status(400).json({ error: 'Invalid Brand ID' });
    }
    if (supplierId) {
      const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId: req.tenantId } });
      if (!supplier) return res.status(400).json({ error: 'Invalid Supplier ID' });
    }
    if (stockUomId) {
      const uom = await prisma.unitOfMeasure.findFirst({ where: { id: stockUomId, tenantId: req.tenantId } });
      if (!uom) return res.status(400).json({ error: 'Invalid Stock UOM ID' });
    }
    if (purchaseUomId) {
      const uom = await prisma.unitOfMeasure.findFirst({ where: { id: purchaseUomId, tenantId: req.tenantId } });
      if (!uom) return res.status(400).json({ error: 'Invalid Purchase UOM ID' });
    }
    if (salesUomId) {
      const uom = await prisma.unitOfMeasure.findFirst({ where: { id: salesUomId, tenantId: req.tenantId } });
      if (!uom) return res.status(400).json({ error: 'Invalid Sales UOM ID' });
    }
    if (inventoryAccountId) {
      const acc = await prisma.account.findFirst({ where: { id: inventoryAccountId, tenantId: req.tenantId } });
      if (!acc) return res.status(400).json({ error: 'Invalid Inventory Account ID' });
    }
    if (cogsAccountId) {
      const acc = await prisma.account.findFirst({ where: { id: cogsAccountId, tenantId: req.tenantId } });
      if (!acc) return res.status(400).json({ error: 'Invalid COGS Account ID' });
    }
    if (productGroupId) {
      const pg = await prisma.productGroup.findFirst({ where: { id: productGroupId, tenantId: req.tenantId } });
      if (!pg) return res.status(400).json({ error: 'Invalid Product Group ID' });
    }

    let resolvedCategoryId = categoryId || null;

    if (!resolvedCategoryId && categoryName) {
      let cat = await prisma.productCategory.findFirst({
        where: { tenantId: req.tenantId, name: categoryName }
      });
      if (!cat) {
        cat = await prisma.productCategory.create({
          data: { tenantId: req.tenantId, name: categoryName }
        });
      }
      resolvedCategoryId = cat.id;
    }

    let resolvedCurrency = currency;
    if (currencyId) {
      const dbCurrency = await prisma.currency.findUnique({ where: { id: currencyId } });
      if (dbCurrency) resolvedCurrency = dbCurrency.code;
    }

    const updatedProduct = await prisma.product.update({
      where: { id, tenantId: req.tenantId },
      data: {
        code,
        name,
        description,
        type,
        costPrice: costPrice !== undefined ? (parseFloat(costPrice) || 0) : undefined,
        sellingPrice: sellingPrice !== undefined ? (parseFloat(sellingPrice) || 0) : undefined,
        categoryId: resolvedCategoryId,
        subCategoryId: subCategoryId !== undefined ? (subCategoryId || null) : undefined,
        brandId: brandId !== undefined ? (brandId || null) : undefined,
        supplierId: supplierId !== undefined ? (supplierId || null) : undefined,
        productTypeId: productTypeId !== undefined ? (productTypeId || null) : undefined,
        hsCode: hsCode !== undefined ? hsCode : undefined,
        cpg: cpg !== undefined ? cpg : undefined,
        currency: resolvedCurrency !== undefined ? resolvedCurrency : undefined,
        currencyId: currencyId !== undefined ? (currencyId || null) : undefined,
        reorderLevel: reorderLevel !== undefined ? (parseInt(reorderLevel) || 0) : undefined,
        isLocked: isLocked !== undefined ? (isLocked === true || isLocked === 'true') : undefined,
        
        // New Parameters
        stockUomId: stockUomId !== undefined ? (stockUomId || null) : undefined,
        purchaseUomId: purchaseUomId !== undefined ? (purchaseUomId || null) : undefined,
        salesUomId: salesUomId !== undefined ? (salesUomId || null) : undefined,
        conversionFactor: conversionFactor !== undefined ? (parseFloat(conversionFactor) || 1.0) : undefined,
        uomConversions: uomConversions !== undefined ? uomConversions : undefined,
        costingMethod: costingMethod !== undefined ? costingMethod : undefined,
        bomApplicable: bomApplicable !== undefined ? (bomApplicable === true || bomApplicable === 'true') : undefined,
        activeStatus: activeStatus !== undefined ? activeStatus : undefined,
        standardCost: standardCost !== undefined ? (parseFloat(standardCost) || 0) : undefined,
        scrapPercent: scrapPercent !== undefined ? (parseFloat(scrapPercent) || 0) : undefined,
        safetyStock: safetyStock !== undefined ? (parseInt(safetyStock) || 0) : undefined,
        taxGroup: taxGroup !== undefined ? taxGroup : undefined,
        inventoryAccountId: inventoryAccountId !== undefined ? (inventoryAccountId || null) : undefined,
        cogsAccountId: cogsAccountId !== undefined ? (cogsAccountId || null) : undefined,
        productGroupId: productGroupId !== undefined ? (productGroupId || null) : undefined,
        productGroup: productGroup !== undefined ? productGroup : undefined
      },
      include: { 
        category: true, 
        brand: true, 
        stockUom: true, 
        purchaseUom: true, 
        salesUom: true, 
        productType: true, 
        supplier: true,
        inventoryAccount: true,
        cogsAccount: true,
        currencyRel: true,
        productGroupRel: true
      }
    });

    res.json(updatedProduct);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.product.delete({
      where: { id, tenantId: req.tenantId }
    });
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
};

const duplicateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { newCode } = req.body;

    if (!newCode || !newCode.trim()) {
      return res.status(400).json({ error: 'New product code is required for duplication' });
    }

    const trimmedNewCode = newCode.trim();

    // 1. Check duplicate code
    const existingCode = await prisma.product.findFirst({
      where: {
        tenantId: req.tenantId,
        code: {
          equals: trimmedNewCode,
          mode: 'insensitive'
        }
      }
    });
    if (existingCode) {
      return res.status(400).json({ error: 'Product code already exists' });
    }

    // 2. Fetch original product
    const originalProduct = await prisma.product.findFirst({
      where: { id, tenantId: req.tenantId }
    });
    if (!originalProduct) {
      return res.status(404).json({ error: 'Source product to duplicate not found' });
    }

    // 3. Create duplicate product
    const duplicatedProduct = await prisma.product.create({
      data: {
        tenantId: req.tenantId,
        code: trimmedNewCode,
        name: `${originalProduct.name} (Copy)`,
        description: originalProduct.description,
        type: originalProduct.type,
        costPrice: originalProduct.costPrice,
        sellingPrice: originalProduct.sellingPrice,
        categoryId: originalProduct.categoryId,
        subCategoryId: originalProduct.subCategoryId,
        brandId: originalProduct.brandId,
        supplierId: originalProduct.supplierId,
        productTypeId: originalProduct.productTypeId,
        hsCode: originalProduct.hsCode,
        cpg: originalProduct.cpg,
        currency: originalProduct.currency,
        currencyId: originalProduct.currencyId,
        reorderLevel: originalProduct.reorderLevel,
        isLocked: originalProduct.isLocked,
        stockUomId: originalProduct.stockUomId,
        purchaseUomId: originalProduct.purchaseUomId,
        salesUomId: originalProduct.salesUomId,
        conversionFactor: originalProduct.conversionFactor,
        uomConversions: originalProduct.uomConversions || [],
        costingMethod: originalProduct.costingMethod,
        bomApplicable: originalProduct.bomApplicable,
        activeStatus: originalProduct.activeStatus,
        standardCost: originalProduct.standardCost,
        scrapPercent: originalProduct.scrapPercent,
        safetyStock: originalProduct.safetyStock,
        taxGroup: originalProduct.taxGroup,
        inventoryAccountId: originalProduct.inventoryAccountId,
        cogsAccountId: originalProduct.cogsAccountId,
        productGroupId: originalProduct.productGroupId,
        productGroup: originalProduct.productGroup,
        createdBy: req.user.userId
      },
      include: {
        category: true,
        brand: true,
        stockUom: true,
        purchaseUom: true,
        salesUom: true,
        productType: true,
        supplier: true,
        inventoryAccount: true,
        cogsAccount: true,
        currencyRel: true,
        productGroupRel: true
      }
    });

    res.status(201).json(duplicatedProduct);
  } catch (error) {
    console.error('Duplicate product error:', error);
    res.status(500).json({ error: 'Failed to duplicate product' });
  }
};

const BATCH_FIELDS = new Set([
  'productTypeId', 'categoryId', 'brandId', 'productGroupId', 'supplierId',
  'stockUomId', 'purchaseUomId', 'salesUomId',
  'costingMethod', 'standardCost', 'scrapPercent', 'safetyStock', 'reorderLevel',
  'taxGroup', 'currencyId', 'inventoryAccountId', 'cogsAccountId',
  'activeStatus', 'bomApplicable', 'isLocked'
]);

const batchUpdateProducts = async (req, res) => {
  try {
    const { ids, changes } = req.body || {};

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Select at least one product' });
    }
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
      return res.status(400).json({ error: 'Select a parameter to update' });
    }

    const uniqueIds = [...new Set(ids.filter((id) => typeof id === 'string' && id.trim()))];
    const keys = Object.keys(changes).filter((key) => BATCH_FIELDS.has(key) && changes[key] !== undefined);
    if (uniqueIds.length === 0 || keys.length === 0) {
      return res.status(400).json({ error: 'Select a parameter to update' });
    }

    const owned = await prisma.product.findMany({
      where: { tenantId: req.tenantId, id: { in: uniqueIds } },
      select: { id: true, stockUomId: true, purchaseUomId: true }
    });
    if (owned.length !== uniqueIds.length) {
      return res.status(400).json({ error: 'One or more products were not found' });
    }

    const data = {};

    const requireId = async (model, id, label) => {
      if (typeof id !== 'string' || !id.trim()) {
        return `${label} is required`;
      }
      const row = await prisma[model].findFirst({ where: { id, tenantId: req.tenantId } });
      if (!row) return `Invalid ${label}`;
      return row;
    };

    for (const key of keys) {
      const value = changes[key];

      if (key === 'productTypeId') {
        const row = await requireId('productType', value, 'Item Type');
        if (typeof row === 'string') return res.status(400).json({ error: row });
        data.productTypeId = value;
      } else if (key === 'categoryId') {
        const row = await requireId('productCategory', value, 'Category');
        if (typeof row === 'string') return res.status(400).json({ error: row });
        data.categoryId = value;
      } else if (key === 'brandId') {
        const row = await requireId('productBrand', value, 'Brand');
        if (typeof row === 'string') return res.status(400).json({ error: row });
        data.brandId = value;
      } else if (key === 'productGroupId') {
        const row = await requireId('productGroup', value, 'Product Group');
        if (typeof row === 'string') return res.status(400).json({ error: row });
        data.productGroupId = value;
        data.productGroup = row.name;
      } else if (key === 'supplierId') {
        const row = await requireId('supplier', value, 'Supplier');
        if (typeof row === 'string') return res.status(400).json({ error: row });
        data.supplierId = value;
      } else if (key === 'stockUomId' || key === 'purchaseUomId' || key === 'salesUomId') {
        const labels = { stockUomId: 'Stock UOM', purchaseUomId: 'Purchase UOM', salesUomId: 'Sales UOM' };
        const row = await requireId('unitOfMeasure', value, labels[key]);
        if (typeof row === 'string') return res.status(400).json({ error: row });
        data[key] = value;
      } else if (key === 'currencyId') {
        const row = await requireId('currency', value, 'Currency');
        if (typeof row === 'string') return res.status(400).json({ error: row });
        data.currencyId = value;
        data.currency = row.code;
      } else if (key === 'inventoryAccountId' || key === 'cogsAccountId') {
        const label = key === 'inventoryAccountId' ? 'Inventory Account' : 'COGS Account';
        const expectedType = key === 'inventoryAccountId' ? 'ASSET' : 'EXPENSE';
        const row = await requireId('account', value, label);
        if (typeof row === 'string') return res.status(400).json({ error: row });
        if (row.type !== expectedType) {
          return res.status(400).json({ error: `Invalid ${label}` });
        }
        data[key] = value;
      } else if (key === 'taxGroup') {
        if (typeof value !== 'string' || !value.trim()) {
          return res.status(400).json({ error: 'Tax Group is required' });
        }
        const row = await prisma.taxGroup.findFirst({
          where: { tenantId: req.tenantId, name: value.trim() }
        });
        if (!row) return res.status(400).json({ error: 'Invalid Tax Group' });
        data.taxGroup = row.name;
      } else if (key === 'costingMethod') {
        if (!['FIFO'].includes(value)) {
          return res.status(400).json({ error: 'Invalid Costing Method' });
        }
        data.costingMethod = value;
      } else if (key === 'activeStatus') {
        if (!['ACTIVE', 'INACTIVE'].includes(value)) {
          return res.status(400).json({ error: 'Invalid Status' });
        }
        data.activeStatus = value;
      } else if (key === 'standardCost' || key === 'scrapPercent' || key === 'safetyStock' || key === 'reorderLevel') {
        const integer = key === 'safetyStock' || key === 'reorderLevel';
        const num = integer ? parseInt(value, 10) : parseFloat(value);
        const label = {
          standardCost: 'Standard Cost',
          scrapPercent: 'Scrap %',
          safetyStock: 'Safety Stock',
          reorderLevel: 'Reorder Level'
        }[key];
        if (!Number.isFinite(num) || num < 0 || (key === 'scrapPercent' && num > 100)) {
          return res.status(400).json({
            error: key === 'scrapPercent'
              ? 'Scrap % must be between 0 and 100'
              : `${label} cannot be negative`
          });
        }
        data[key] = num;
      } else if (key === 'bomApplicable' || key === 'isLocked') {
        data[key] = value === true || value === 'true';
      }
    }

    const touchesUom = data.stockUomId !== undefined || data.purchaseUomId !== undefined;
    if (touchesUom) {
      await prisma.$transaction(owned.map((product) => {
        const stockUomId = data.stockUomId !== undefined ? data.stockUomId : product.stockUomId;
        const purchaseUomId = data.purchaseUomId !== undefined ? data.purchaseUomId : product.purchaseUomId;
        const rowData = { ...data };
        if (stockUomId && purchaseUomId && stockUomId === purchaseUomId) {
          rowData.conversionFactor = 1;
        }
        return prisma.product.update({ where: { id: product.id }, data: rowData });
      }));
    } else {
      await prisma.product.updateMany({
        where: { tenantId: req.tenantId, id: { in: uniqueIds } },
        data
      });
    }

    res.json({ updated: uniqueIds.length });
  } catch (error) {
    console.error('Batch update products error:', error);
    res.status(500).json({ error: 'Failed to update products' });
  }
};

module.exports = { getProducts, getAttributes, createProduct, updateProduct, deleteProduct, duplicateProduct, batchUpdateProducts };
