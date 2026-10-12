import { CaseType } from '@prisma/client';

export const presentCaseType = (c: CaseType) => ({
  code: c.code,
  name: c.name,
  icon: c.icon,
  color: c.color,
  priority: c.priority,
});
