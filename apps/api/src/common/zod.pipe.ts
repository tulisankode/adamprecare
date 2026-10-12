import { PipeTransform } from '@nestjs/common';
import { z, ZodTypeAny } from 'zod';
import { AppError } from './app-error';

/** Validasi body/query dengan zod; error menjadi VALIDATION_ERROR per field. */
export class ZodPipe<S extends ZodTypeAny> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value ?? {});
    if (result.success) return result.data;
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '_',
      message: issue.message,
    }));
    throw AppError.validation(details[0]?.message ?? 'Data tidak valid.', details);
  }
}
