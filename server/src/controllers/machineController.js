const prisma = require('../lib/prisma');

const mapMachine = (row) => ({
  id: row.id,
  code: row.code,
  name: row.name,
  modelNumber: row.model_number || '',
  manufacturer: row.manufacturer || '',
  serialNumber: row.serial_number || '',
  watts: row.watts == null ? null : Number(row.watts),
  year: row.year == null ? null : Number(row.year),
  workstationId: row.workstation_id,
  posX: Number(row.pos_x),
  posY: Number(row.pos_y),
  width: Number(row.width) || 176,
  height: Number(row.height) || 72,
  rotation: Number(row.rotation) || 0,
  workstation: row.workstation_code
    ? { id: row.workstation_id, code: row.workstation_code, name: row.workstation_name }
    : null
});

const machineSelect = `
  SELECT m.id, m.code, m.name, m.model_number, m.manufacturer, m.serial_number, m.watts, m.year,
         m.workstation_id, m.pos_x, m.pos_y, m.width, m.height, m.rotation,
         w.code AS workstation_code, w.name AS workstation_name
  FROM machines m
  LEFT JOIN workstations w ON w.id = m.workstation_id
`;

const clampNumber = (value, min, max, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
};

const normalizeRotation = (value, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return ((number % 360) + 360) % 360;
};

const textOrNull = (value) => {
  const text = String(value || '').trim();
  return text || null;
};

const intOrNull = (value, label) => {
  if (value === '' || value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isInteger(number) || number < 0) {
    const error = new Error(`${label} cannot be negative`);
    error.status = 400;
    throw error;
  }
  return number;
};

const nextMachineCode = async (tenantId) => {
  const rows = await prisma.$queryRaw`
    SELECT code FROM machines WHERE tenant_id = ${tenantId} AND code LIKE 'MC-%'
  `;
  let max = 0;
  rows.forEach((row) => {
    const match = /^MC-(\d+)$/.exec(row.code || '');
    if (match) max = Math.max(max, parseInt(match[1], 10));
  });
  return `MC-${String(max + 1).padStart(3, '0')}`;
};

const mapRate = (row) => ({
  productId: row.productId,
  maxThroughput: Number(row.maxThroughput),
  idleThroughput: Number(row.idleThroughput)
});

async function withThroughputs(tenantId, machines) {
  if (!machines.length) return machines;
  const rows = await prisma.machineThroughput.findMany({
    where: { tenantId, machineId: { in: machines.map((machine) => machine.id) } }
  });
  const grouped = new Map();
  rows.forEach((row) => {
    const list = grouped.get(row.machineId) || [];
    list.push(mapRate(row));
    grouped.set(row.machineId, list);
  });
  return machines.map((machine) => ({ ...machine, throughputs: grouped.get(machine.id) || [] }));
}

async function saveThroughputs(tenantId, machineId, rows) {
  if (!Array.isArray(rows)) return;
  const ids = [...new Set(rows.map((row) => row.productId).filter(Boolean))];
  const products = ids.length
    ? await prisma.product.findMany({
      where: {
        tenantId,
        id: { in: ids },
        productType: { kind: { in: ['FINISHED_GOOD', 'SEMI_FINISHED'] } }
      },
      select: { id: true }
    })
    : [];
  const allowed = new Set(products.map((product) => product.id));
  for (const row of rows) {
    if (!allowed.has(row.productId)) continue;
    const maxThroughput = parseFloat(row.maxThroughput || 0);
    const idleThroughput = parseFloat(row.idleThroughput || 0);
    if (Number.isNaN(maxThroughput) || Number.isNaN(idleThroughput) || maxThroughput < 0 || idleThroughput < 0) {
      const error = new Error('Throughput cannot be negative');
      error.status = 400;
      throw error;
    }
    if (maxThroughput === 0 && idleThroughput === 0) {
      await prisma.machineThroughput.deleteMany({ where: { machineId, productId: row.productId } });
      continue;
    }
    await prisma.machineThroughput.upsert({
      where: { machineId_productId: { machineId, productId: row.productId } },
      update: { maxThroughput, idleThroughput },
      create: { tenantId, machineId, productId: row.productId, maxThroughput, idleThroughput }
    });
  }
}

const getMachines = async (req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `${machineSelect} WHERE m.tenant_id = $1 ORDER BY m.code ASC`,
      req.tenantId
    );
    res.json(await withThroughputs(req.tenantId, rows.map(mapMachine)));
  } catch (error) {
    console.error('Fetch machines error:', error);
    res.status(500).json({ error: 'Failed to fetch machines' });
  }
};

const createMachine = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const modelNumber = textOrNull(req.body.modelNumber);
    const manufacturer = textOrNull(req.body.manufacturer);
    const serialNumber = textOrNull(req.body.serialNumber);
    const watts = intOrNull(req.body.watts, 'Watts');
    const year = intOrNull(req.body.year, 'Year');
    const workstationId = req.body.workstationId || null;
    const posX = Number.isFinite(Number(req.body.posX)) ? Number(req.body.posX) : 80;
    const posY = Number.isFinite(Number(req.body.posY)) ? Number(req.body.posY) : 80;
    const width = clampNumber(req.body.width, 112, 2400, 176);
    const height = clampNumber(req.body.height, 56, 1600, 72);
    const rotation = normalizeRotation(req.body.rotation, 0);
    if (!name) {
      return res.status(400).json({ error: 'Machine name is required' });
    }
    if (workstationId) {
      const station = await prisma.workstation.findFirst({
        where: { id: workstationId, tenantId: req.tenantId }
      });
      if (!station) {
        return res.status(400).json({ error: 'Workstation not found' });
      }
    }
    const code = await nextMachineCode(req.tenantId);
    const rows = await prisma.$queryRaw`
      INSERT INTO machines (
        id, tenant_id, workstation_id, code, name, model_number, manufacturer, serial_number, watts, year,
        pos_x, pos_y, width, height, rotation, created_at, updated_at
      )
      VALUES (
        gen_random_uuid()::text, ${req.tenantId}, ${workstationId}, ${code}, ${name}, ${modelNumber}, ${manufacturer}, ${serialNumber}, ${watts}, ${year},
        ${posX}, ${posY}, ${width}, ${height}, ${rotation}, NOW(), NOW()
      )
      RETURNING id
    `;
    const created = await prisma.$queryRawUnsafe(
      `${machineSelect} WHERE m.id = $1 AND m.tenant_id = $2`,
      rows[0].id,
      req.tenantId
    );
    await saveThroughputs(req.tenantId, rows[0].id, req.body.throughputs);
    const [machine] = await withThroughputs(req.tenantId, [mapMachine(created[0])]);
    res.status(201).json(machine);
  } catch (error) {
    console.error('Create machine error:', error);
    const status = error.status || 500;
    res.status(status).json({ error: status === 400 ? error.message : 'Failed to create machine' });
  }
};

const updateMachine = async (req, res) => {
  try {
    const existingRows = await prisma.$queryRaw`
      SELECT id FROM machines WHERE id = ${req.params.id} AND tenant_id = ${req.tenantId}
    `;
    if (!existingRows.length) {
      return res.status(404).json({ error: 'Machine not found' });
    }
    const current = await prisma.$queryRawUnsafe(
      `${machineSelect} WHERE m.id = $1 AND m.tenant_id = $2`,
      req.params.id,
      req.tenantId
    );
    const machine = mapMachine(current[0]);
    const name = req.body.name !== undefined ? String(req.body.name || '').trim() : machine.name;
    const modelNumber = req.body.modelNumber !== undefined ? textOrNull(req.body.modelNumber) : (machine.modelNumber || null);
    const manufacturer = req.body.manufacturer !== undefined ? textOrNull(req.body.manufacturer) : (machine.manufacturer || null);
    const serialNumber = req.body.serialNumber !== undefined ? textOrNull(req.body.serialNumber) : (machine.serialNumber || null);
    const watts = req.body.watts !== undefined ? intOrNull(req.body.watts, 'Watts') : machine.watts;
    const year = req.body.year !== undefined ? intOrNull(req.body.year, 'Year') : machine.year;
    const workstationId = req.body.workstationId !== undefined ? (req.body.workstationId || null) : machine.workstationId;
    const posX = req.body.posX !== undefined ? Number(req.body.posX) : machine.posX;
    const posY = req.body.posY !== undefined ? Number(req.body.posY) : machine.posY;
    const width = req.body.width !== undefined ? clampNumber(req.body.width, 112, 2400, machine.width) : machine.width;
    const height = req.body.height !== undefined ? clampNumber(req.body.height, 56, 1600, machine.height) : machine.height;
    const rotation = req.body.rotation !== undefined ? normalizeRotation(req.body.rotation, machine.rotation) : machine.rotation;
    if (!name) {
      return res.status(400).json({ error: 'Machine name is required' });
    }
    if (workstationId) {
      const station = await prisma.workstation.findFirst({
        where: { id: workstationId, tenantId: req.tenantId }
      });
      if (!station) {
        return res.status(400).json({ error: 'Workstation not found' });
      }
    }
    await prisma.$executeRaw`
      UPDATE machines
      SET name = ${name},
          model_number = ${modelNumber},
          manufacturer = ${manufacturer},
          serial_number = ${serialNumber},
          watts = ${watts},
          year = ${year},
          workstation_id = ${workstationId},
          pos_x = ${posX},
          pos_y = ${posY},
          width = ${width},
          height = ${height},
          rotation = ${rotation},
          updated_at = NOW()
      WHERE id = ${req.params.id} AND tenant_id = ${req.tenantId}
    `;
    const updated = await prisma.$queryRawUnsafe(
      `${machineSelect} WHERE m.id = $1 AND m.tenant_id = $2`,
      req.params.id,
      req.tenantId
    );
    await saveThroughputs(req.tenantId, req.params.id, req.body.throughputs);
    const [saved] = await withThroughputs(req.tenantId, [mapMachine(updated[0])]);
    res.json(saved);
  } catch (error) {
    console.error('Update machine error:', error);
    const status = error.status || 500;
    res.status(status).json({ error: status === 400 ? error.message : 'Failed to update machine' });
  }
};

const deleteMachine = async (req, res) => {
  try {
    const result = await prisma.$executeRaw`
      DELETE FROM machines WHERE id = ${req.params.id} AND tenant_id = ${req.tenantId}
    `;
    if (!result) {
      return res.status(404).json({ error: 'Machine not found' });
    }
    res.json({ message: 'Machine removed' });
  } catch (error) {
    console.error('Delete machine error:', error);
    res.status(500).json({ error: 'Failed to remove machine' });
  }
};

module.exports = {
  getMachines,
  createMachine,
  updateMachine,
  deleteMachine
};
