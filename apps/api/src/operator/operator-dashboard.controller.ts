import { Controller, Get, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { currentMonthRange, dateList, jakartaDate, jakartaRange } from '../common/format';
import { ok } from '../common/response';
import { dateOnlySchema } from '../common/validators';
import { ZodPipe } from '../common/zod.pipe';
import { AppError } from '../common/app-error';
import { AuthUser, CurrentUser, Roles, STAFF_ROLES } from '../auth/auth.decorators';
import { PrismaService } from '../core/prisma.service';
import { facilityParamSchema, incomingRequests, scopeFacility } from './operator.scope';

const rangeSchema = facilityParamSchema.extend({ from: dateOnlySchema.optional(), to: dateOnlySchema.optional() });
type RangeQuery = z.infer<typeof rangeSchema>;

const MAX_DAYS = 366;

/** Statistik halaman Dashboard (docs/api_contract.md §5.2). */
@Roles(...STAFF_ROLES)
@Controller('operator/dashboard')
export class OperatorDashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('summary')
  async summary(@CurrentUser() user: AuthUser, @Query(new ZodPipe(rangeSchema)) q: RangeQuery) {
    const where = this.where(user, q);
    const [total, cancelled] = await Promise.all([
      this.prisma.emergencyRequest.count({ where }),
      this.prisma.emergencyRequest.count({ where: { AND: [where, { status: 'DIBATALKAN' }] } }),
    ]);
    return ok({ total_calls: total, total_cancelled: cancelled });
  }

  @Get('by-case-type')
  async byCaseType(@CurrentUser() user: AuthUser, @Query(new ZodPipe(rangeSchema)) q: RangeQuery) {
    const [groups, types] = await Promise.all([
      this.prisma.emergencyRequest.groupBy({ by: ['caseTypeId'], where: this.where(user, q), _count: { _all: true } }),
      this.prisma.caseType.findMany({ orderBy: { sortOrder: 'asc' } }),
    ]);
    const counts = new Map(groups.map((g) => [g.caseTypeId, g._count._all]));
    const rows = types
      .map((t) => ({ code: t.code, name: t.name, color: t.color, count: counts.get(t.id) ?? 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return ok(rows);
  }

  @Get('daily')
  async daily(@CurrentUser() user: AuthUser, @Query(new ZodPipe(rangeSchema)) q: RangeQuery) {
    const { from, to } = this.range(q);
    const [requests, types] = await Promise.all([
      this.prisma.emergencyRequest.findMany({ where: this.where(user, q), select: { requestedAt: true, caseTypeId: true } }),
      this.prisma.caseType.findMany({ orderBy: { sortOrder: 'asc' } }),
    ]);
    const dates = dateList(from, to);
    const index = new Map(dates.map((d, i) => [d, i]));
    const series = types.map((t) => ({ id: t.id, code: t.code, name: t.name, color: t.color, data: dates.map(() => 0) }));
    const byType = new Map(series.map((s) => [s.id, s]));
    for (const r of requests) {
      const i = index.get(jakartaDate(r.requestedAt));
      const s = byType.get(r.caseTypeId);
      if (i !== undefined && s) s.data[i] += 1;
    }
    return ok({ dates, series: series.map(({ id: _id, ...s }) => s) });
  }

  private range(q: RangeQuery) {
    const fallback = currentMonthRange();
    const from = q.from ?? fallback.from;
    const to = q.to ?? fallback.to;
    if (from > to) throw AppError.field('from', 'Tanggal awal harus sebelum tanggal akhir.');
    if ((Date.parse(to) - Date.parse(from)) / 86400000 > MAX_DAYS) throw AppError.field('to', 'Rentang maksimal 1 tahun.');
    return { from, to };
  }

  private where(user: AuthUser, q: RangeQuery): Prisma.EmergencyRequestWhereInput {
    const { from, to } = this.range(q);
    return { AND: [incomingRequests(scopeFacility(user, q.facility_id)), { requestedAt: jakartaRange(from, to) }] };
  }
}
