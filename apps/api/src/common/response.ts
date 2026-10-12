import { z } from 'zod';

export interface Paged<T> {
  data: T[];
  meta: { page: number; per_page: number; total: number; total_pages: number; [key: string]: unknown };
}

export const ok = <T>(data: T) => ({ data });

export const paged = <T>(items: T[], total: number, page: number, perPage: number, extra: Record<string, unknown> = {}): Paged<T> => ({
  data: items,
  meta: { page, per_page: perPage, total, total_pages: Math.max(1, Math.ceil(total / perPage)), ...extra },
});

export const success = () => ({ data: { success: true } });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(10),
});

export type Pagination = z.infer<typeof paginationSchema>;

export const skipTake = (p: Pagination) => ({ skip: (p.page - 1) * p.per_page, take: p.per_page });
