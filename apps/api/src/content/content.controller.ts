import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { AppError } from '../common/app-error';
import { ok, paged, Pagination, paginationSchema, skipTake } from '../common/response';
import { ZodPipe } from '../common/zod.pipe';
import { Public } from '../auth/auth.decorators';
import { PrismaService } from '../core/prisma.service';
import { presentCaseType } from './case-type.presenter';

const platformSchema = z.object({ platform: z.enum(['android', 'ios']) });

/** Konten publik: banner, artikel, tipe kasus, halaman statis, versi aplikasi. */
@Public()
@Controller()
export class ContentController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('banners')
  async banners() {
    const now = new Date();
    const banners = await this.prisma.banner.findMany({
      where: {
        AND: [{ OR: [{ activeFrom: null }, { activeFrom: { lte: now } }] }, { OR: [{ activeUntil: null }, { activeUntil: { gte: now } }] }],
      },
      orderBy: { sortOrder: 'asc' },
    });
    return ok(banners.map((b) => ({ id: b.id, title: b.title, image_url: b.imageUrl, action_url: b.actionUrl })));
  }

  @Get('articles')
  async articles(@Query(new ZodPipe(paginationSchema)) q: Pagination) {
    const where = { publishedAt: { lte: new Date() } };
    const [items, total] = await Promise.all([
      this.prisma.article.findMany({ where, orderBy: { publishedAt: 'desc' }, ...skipTake(q) }),
      this.prisma.article.count({ where }),
    ]);
    return paged(
      items.map((a) => ({ id: a.id, slug: a.slug, title: a.title, cover_url: a.coverUrl, excerpt: a.excerpt, published_at: a.publishedAt })),
      total,
      q.page,
      q.per_page,
    );
  }

  @Get('articles/:slug')
  async article(@Param('slug') slug: string) {
    const a = await this.prisma.article.findFirst({ where: { slug, publishedAt: { lte: new Date() } } });
    if (!a) throw AppError.notFound('Artikel tidak ditemukan.');
    return ok({ id: a.id, slug: a.slug, title: a.title, cover_url: a.coverUrl, body_html: a.bodyHtml, published_at: a.publishedAt });
  }

  @Get('case-types')
  async caseTypes() {
    const types = await this.prisma.caseType.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
    return ok(types.map(presentCaseType));
  }

  @Get('pages/:slug')
  async page(@Param('slug') slug: string) {
    const p = await this.prisma.page.findUnique({ where: { slug } });
    if (!p) throw AppError.notFound('Halaman tidak ditemukan.');
    return ok({ slug: p.slug, title: p.title, body_html: p.bodyHtml, updated_at: p.updatedAt });
  }

  @Get('app-versions/latest')
  async latestVersion(@Query(new ZodPipe(platformSchema)) q: z.infer<typeof platformSchema>) {
    const v = await this.prisma.appVersion.findFirst({ where: { platform: q.platform }, orderBy: { releasedAt: 'desc' } });
    if (!v) throw AppError.notFound('Belum ada versi aplikasi.');
    return ok({ version: v.version, min_supported_version: v.minSupportedVersion, release_notes: v.releaseNotes, released_at: v.releasedAt });
  }

  @Get('health')
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return ok({ status: 'ok' });
  }
}
