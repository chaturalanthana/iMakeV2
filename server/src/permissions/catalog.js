const ACTIONS = ['read', 'write'];

const MODULES = [
  { id: 'settings', name: 'Settings (Roles & Users)' },
  { id: 'products', name: 'Products & Catalogs' },
  { id: 'sales', name: 'Sales & Invoices' },
  { id: 'procurement', name: 'Procurement & Purchases' },
  { id: 'finance', name: 'Finance & Accounts' },
  { id: 'hr', name: 'Human Resources' },
  { id: 'warehouse', name: 'Inventory & Warehousing' },
  { id: 'production', name: 'Production & Manufacturing' },
  { id: 'costing', name: 'Costing' }
];

const READ_WRITE = ['read', 'write'];
const READ = ['read'];

const DEFAULT_ROLES = [
  {
    name: 'Super Admin',
    description: 'Default system administrator with full access.',
    isSystem: true,
    permissions: { all: true }
  },
  {
    name: 'Sales',
    description: 'Sales documents and customer masters.',
    isSystem: false,
    permissions: { sales: READ_WRITE, products: READ, warehouse: READ, costing: READ }
  },
  {
    name: 'Procurement',
    description: 'Purchasing documents.',
    isSystem: false,
    permissions: { procurement: READ_WRITE, products: READ, warehouse: READ }
  },
  {
    name: 'Warehouse',
    description: 'Inventory documents.',
    isSystem: false,
    permissions: { warehouse: READ_WRITE, products: READ }
  },
  {
    name: 'Production',
    description: 'Manufacturing, BOM, and planning.',
    isSystem: false,
    permissions: { production: READ_WRITE, products: READ, warehouse: READ, costing: READ }
  },
  {
    name: 'Finance',
    description: 'Accounting and payments.',
    isSystem: false,
    permissions: { finance: READ_WRITE, sales: READ, procurement: READ, costing: READ }
  },
  {
    name: 'Human Resources',
    description: 'Employees, leave, and payroll.',
    isSystem: false,
    permissions: { hr: READ_WRITE }
  }
];

function permissionObject(permissions) {
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) return {};
  return permissions;
}

function hasFullAccess(role) {
  if (!role) return false;
  const permissions = permissionObject(role.permissions);
  if (permissions.all === true) return true;

  const explicit = Object.keys(permissions).filter((key) => key !== 'all');
  if (explicit.length > 0) return false;

  if (role.isSystem) return true;
  const name = String(role.name || '').trim().toLowerCase();
  return name === 'admin' || name === 'super admin' || name === 'administrator';
}

function allows(permissions, moduleName, action) {
  const value = permissionObject(permissions);
  if (value.all === true) return true;
  const granted = value[moduleName];
  if (granted === true) return true;
  if (!Array.isArray(granted)) return false;
  return granted.includes(action) || granted.includes('*');
}

function actionForMethod(method) {
  const verb = String(method || 'GET').toUpperCase();
  if (verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS') return 'read';
  return 'write';
}

async function seedTenantRoles(db, tenantId) {
  for (const role of DEFAULT_ROLES) {
    const existing = await db.role.findUnique({
      where: { tenantId_name: { tenantId, name: role.name } }
    });
    if (existing) continue;
    await db.role.create({
      data: {
        tenantId,
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        isSystem: role.isSystem
      }
    });
  }
}

module.exports = {
  ACTIONS,
  MODULES,
  DEFAULT_ROLES,
  hasFullAccess,
  allows,
  actionForMethod,
  seedTenantRoles
};
