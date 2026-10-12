import { Controller, Get, Param, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../common/app-error';
import { ok, paged, paginationSchema } from '../common/response';
import { latSchema, lngSchema, uuidSchema } from '../common/validators';
import { ZodPipe } from '../common/zod.pipe';
import { PrismaService } from '../core/prisma.service';

const listSchema = paginationSchema.extend({
  lat: latSchema.optional(),
  lng: lngSchema.optional(),
  q: z.string().trim().max(100).optional(),
  type: z.enum(['RUMAH_SAKIT', 'KLINIK', 'PUSKESMAS']).optional(),
});

const pointSchema = z.object({ lat: latSchema.optional(), lng: lngSchema.optional() });

interface FacilityRow {
  id: string;
  name: string;
  type: string;
  address: string;
  phone: string;
  photo_url: string | null;
  lat: number;
  lng: number;
  distance_km: number | null;
}

/** Direktori FASKES (layar Lokasi FASKES). PSC 119 tidak ditampilkan. */
@Controller('facilities')
export class FacilitiesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query(new ZodPipe(listSchema)) q: z.infer<typeof listSchema>) {
    const hasPoint = q.lat !== undefined && q.lng !== undefined;
    const distance = hasPoint
      ? Prisma.sql`ROUND((ST_Distance(ST_SetSRID(ST_MakePoint(f.lng, f.lat), 4326)::geography, ST_SetSRID(ST_MakePoint(${q.lng}, ${q.lat}), 4326)::geography) / 1000)::numeric, 2)::float8`
      : Prisma.sql`NULL::float8`;
    const conditions = [Prisma.sql`f.is_active`, Prisma.sql`f.show_in_directory`, Prisma.sql`f.type <> 'PSC_119'`];
    if (q.q) conditions.push(Prisma.sql`(f.name ILIKE ${`%${q.q}%`} OR f.address ILIKE ${`%${q.q}%`})`);
    if (q.type) conditions.push(Prisma.sql`f.type = ${q.type}::"FacilityType"`);
    const where = Prisma.join(conditions, ' AND ');
    const order = hasPoint ? Prisma.sql`distance_km ASC` : Prisma.sql`f.name ASC`;

    const [rows, count] = await Promise.all([
      this.prisma.$queryRaw<FacilityRow[]>`
        SELECT f.id, f.name, f.type::text AS type, f.address, f.phone, f.photo_url, f.lat, f.lng, ${distance} AS distance_km
        FROM facilities f WHERE ${where} ORDER BY ${order}
        LIMIT ${q.per_page} OFFSET ${(q.page - 1) * q.per_page}`,
      this.prisma.$queryRaw<{ total: bigint }[]>`SELECT COUNT(*) AS total FROM facilities f WHERE ${where}`,
    ]);
    const polyclinics = await this.polyclinics(rows.map((r) => r.id));
    return paged(
      rows.map((r) => this.present(r, polyclinics.get(r.id) ?? [])),
      Number(count[0].total),
      q.page,
      q.per_page,
    );
  }

  @Get(':id')
  async detail(@Param('id', new ZodPipe(uuidSchema)) id: string, @Query(new ZodPipe(pointSchema)) q: z.infer<typeof pointSchema>) {
    const hasPoint = q.lat !== undefined && q.lng !== undefined;
    const distance = hasPoint
      ? Prisma.sql`ROUND((ST_Distance(ST_SetSRID(ST_MakePoint(f.lng, f.lat), 4326)::geography, ST_SetSRID(ST_MakePoint(${q.lng}, ${q.lat}), 4326)::geography) / 1000)::numeric, 2)::float8`
      : Prisma.sql`NULL::float8`;
    const rows = await this.prisma.$queryRaw<FacilityRow[]>`
      SELECT f.id, f.name, f.type::text AS type, f.address, f.phone, f.photo_url, f.lat, f.lng, ${distance} AS distance_km
      FROM facilities f WHERE f.id = ${id}::uuid AND f.is_active AND f.show_in_directory AND f.type <> 'PSC_119'`;
    if (!rows[0]) throw AppError.notFound('FASKES tidak ditemukan.');
    const polyclinics = await this.polyclinics([id]);
    return ok(this.present(rows[0], polyclinics.get(id) ?? []));
  }

  private async polyclinics(ids: string[]) {
    const map = new Map<string, string[]>();
    if (!ids.length) return map;
    const links = await this.prisma.facilityPolyclinic.findMany({
      where: { facilityId: { in: ids } },
      include: { polyclinic: true },
      orderBy: { polyclinic: { name: 'asc' } },
    });
    for (const l of links) map.set(l.facilityId, [...(map.get(l.facilityId) ?? []), l.polyclinic.name]);
    return map;
  }

  private present(r: FacilityRow, polyclinics: string[]) {
    return {
      id: r.id,
      name: r.name,
      type: r.type,
      address: r.address,
      phone: r.phone,
      photo_url: r.photo_url,
      location: { lat: r.lat, lng: r.lng },
      distance_km: r.distance_km,
      polyclinics,
      maps_url: `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`,
    };
  }
}
