import { isUuid } from './bomPath';

export function workstationPath(workstation) {
  const code = workstation?.code;
  if (!code) {
    return workstation?.id ? `/production/workstations/${workstation.id}` : '/production/workstations';
  }
  return `/production/workstations/${encodeURIComponent(code)}`;
}

export { isUuid };
