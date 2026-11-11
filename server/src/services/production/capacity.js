const { round4, num } = require('./costing');

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [1, 2, 3, 4, 5];
    } catch (error) {
      return [1, 2, 3, 4, 5];
    }
  }
  return [1, 2, 3, 4, 5];
};

const dateKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const eachDay = (from, to) => {
  const days = [];
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
};

const hoursBetween = (start, end) => {
  const [sh, sm] = String(start || '08:00').split(':').map((part) => parseInt(part, 10) || 0);
  const [eh, em] = String(end || '16:00').split(':').map((part) => parseInt(part, 10) || 0);
  let minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes / 60;
};

const efficiencyFactor = (value) => {
  const factor = num(value);
  if (!(factor > 0)) return 1;
  if (factor > 2) return factor / 100;
  return factor;
};

const weekKey = (date) => {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  copy.setUTCDate(copy.getUTCDate() + 3 - ((copy.getUTCDay() + 6) % 7));
  const week1 = new Date(Date.UTC(copy.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((copy - week1) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7);
  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

const eventApplies = (event, workstation) => {
  if (!event.workCenterId || !workstation) return !event.workCenterId;
  return event.workCenterId === workstation.id || event.workCenterId === workstation.code;
};

function availableHours(date, workstation, settings, shifts, events) {
  const key = dateKey(date);
  const blocked = (events || []).some((event) => (
    dateKey(event.date) === key
    && (event.type === 'HOLIDAY' || event.type === 'MAINTENANCE')
    && eventApplies(event, workstation)
  ));
  if (blocked) return 0;

  const weekday = date.getUTCDay();
  const workDays = asArray(settings.workDays).map(Number);
  let base = 0;
  if (workDays.includes(weekday)) {
    const staffed = (shifts || []).reduce((total, shift) => {
      const days = asArray(shift.workDays).map(Number);
      if (days.length && !days.includes(weekday)) return total;
      return total + hoursBetween(shift.startTime, shift.endTime);
    }, 0);
    base = staffed > 0 ? staffed : (num(settings.hoursPerDay) || 8);
  }

  let extra = 0;
  (events || []).forEach((event) => {
    if (dateKey(event.date) !== key || event.type !== 'OVERTIME') return;
    if (!eventApplies(event, workstation) && event.workCenterId) return;
    const metadata = event.metadata && typeof event.metadata === 'object' ? event.metadata : {};
    extra += num(metadata.hours) || 2;
  });

  const capacity = workstation ? (num(workstation.capacity) || 1) : 1;
  const efficiency = efficiencyFactor(workstation ? workstation.efficiency : 1);
  return round4((base + extra) * capacity * efficiency);
}

function spreadHours(load, days) {
  const start = load.startDate ? new Date(load.startDate) : days[0];
  const end = load.endDate ? new Date(load.endDate) : start;
  const inRange = days.filter((day) => {
    const key = dateKey(day);
    return key >= dateKey(start) && key <= dateKey(end);
  });
  const workDays = inRange.filter((day) => asArray(load.workDays).map(Number).includes(day.getUTCDay()));
  const targets = workDays.length ? workDays : (inRange.length ? [inRange[0]] : [days[0]]);
  const slice = targets.length ? round4(num(load.hours) / targets.length) : 0;
  const map = new Map();
  targets.forEach((day) => map.set(dateKey(day), slice));
  // Put rounding residue on the last day so the total is preserved.
  const placed = round4(slice * targets.length);
  const residue = round4(num(load.hours) - placed);
  if (targets.length && residue !== 0) {
    const last = dateKey(targets[targets.length - 1]);
    map.set(last, round4((map.get(last) || 0) + residue));
  }
  return map;
}

function buildLoadProfile({ from, to, settings, workstations = [], shifts = [], events = [], loads = [] }) {
  const days = eachDay(from, to);
  const groups = new Map();
  const ensure = (workstation) => {
    const id = workstation?.id || 'unassigned';
    if (!groups.has(id)) {
      groups.set(id, {
        id: workstation?.id || null,
        code: workstation?.code || 'UNASSIGNED',
        name: workstation?.name || 'Unassigned',
        days: new Map()
      });
    }
    return groups.get(id);
  };

  workstations.forEach((workstation) => ensure(workstation));
  const byId = new Map(workstations.map((workstation) => [workstation.id, workstation]));

  days.forEach((day) => {
    workstations.forEach((workstation) => {
      const group = ensure(workstation);
      group.days.set(dateKey(day), {
        date: dateKey(day),
        loadHours: 0,
        availableHours: availableHours(day, workstation, settings, shifts, events),
        overload: false
      });
    });
  });

  loads.forEach((load) => {
    const workstation = load.workstationId ? byId.get(load.workstationId) : null;
    const group = ensure(workstation || { id: load.workstationId, code: load.code, name: load.name });
    const portions = spreadHours({ ...load, workDays: settings.workDays }, days);
    portions.forEach((hours, key) => {
      if (!group.days.has(key)) {
        const day = new Date(`${key}T00:00:00.000Z`);
        group.days.set(key, {
          date: key,
          loadHours: 0,
          availableHours: availableHours(day, workstation, settings, shifts, events),
          overload: false
        });
      }
      const bucket = group.days.get(key);
      bucket.loadHours = round4(bucket.loadHours + hours);
    });
  });

  const overloads = [];
  const rows = [...groups.values()].map((group) => {
    const dayRows = [...group.days.values()].sort((a, b) => a.date.localeCompare(b.date));
    dayRows.forEach((day) => {
      day.overload = day.loadHours > day.availableHours + 0.0001;
      if (day.overload) {
        overloads.push({
          workstationId: group.id,
          code: group.code,
          name: group.name,
          date: day.date,
          loadHours: day.loadHours,
          availableHours: day.availableHours
        });
      }
    });
    const weeks = new Map();
    dayRows.forEach((day) => {
      const key = weekKey(new Date(`${day.date}T00:00:00.000Z`));
      const week = weeks.get(key) || { week: key, loadHours: 0, availableHours: 0, overload: false };
      week.loadHours = round4(week.loadHours + day.loadHours);
      week.availableHours = round4(week.availableHours + day.availableHours);
      week.overload = week.loadHours > week.availableHours + 0.0001;
      weeks.set(key, week);
    });
    const loadHours = round4(dayRows.reduce((sum, day) => sum + day.loadHours, 0));
    const available = round4(dayRows.reduce((sum, day) => sum + day.availableHours, 0));
    return {
      id: group.id,
      code: group.code,
      name: group.name,
      loadHours,
      availableHours: available,
      overload: loadHours > available + 0.0001,
      days: dayRows,
      weeks: [...weeks.values()]
    };
  }).sort((a, b) => String(a.code).localeCompare(String(b.code)));

  return {
    method: 'INFINITE',
    from: dateKey(from),
    to: dateKey(to),
    workstations: rows,
    overloads
  };
}

module.exports = {
  buildLoadProfile,
  availableHours,
  efficiencyFactor,
  dateKey
};
