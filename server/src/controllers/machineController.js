const prisma = require('../lib/prisma');

const mapMachine = (row) => ({
  id: row.id,
  code: row.code,
  name: row.name,
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
  SELECT m.id, m.code, m.name, m.workstation_id, m.pos_x, m.pos_y, m.width, m.height, m.rotation,
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

const getMachines = async (req, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `${machineSelect} WHERE m.tenant_id = $1 ORDER BY m.code ASC`,
      req.tenantId
    );
    res.json(rows.map(mapMachine));
  } catch (error) {
    console.error('Fetch machines error:', error);
    res.status(500).json({ error: 'Failed to fetch machines' });
  }
};

const createMachine = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
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
      INSERT INTO machines (id, tenant_id, workstation_id, code, name, pos_x, pos_y, width, height, rotation, created_at, updated_at)
      VALUES (gen_random_uuid()::text, ${req.tenantId}, ${workstationId}, ${code}, ${name}, ${posX}, ${posY}, ${width}, ${height}, ${rotation}, NOW(), NOW())
      RETURNING id
    `;
    const created = await prisma.$queryRawUnsafe(
      `${machineSelect} WHERE m.id = $1 AND m.tenant_id = $2`,
      rows[0].id,
      req.tenantId
    );
    res.status(201).json(mapMachine(created[0]));
  } catch (error) {
    console.error('Create machine error:', error);
    res.status(500).json({ error: 'Failed to create machine' });
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
    res.json(mapMachine(updated[0]));
  } catch (error) {
    console.error('Update machine error:', error);
    res.status(500).json({ error: 'Failed to update machine' });
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
