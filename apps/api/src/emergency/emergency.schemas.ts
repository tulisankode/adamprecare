import { z } from 'zod';
import { identitySchema, latSchema, lngSchema } from '../common/validators';

export const createRequestSchema = z
  .object({
    client_request_id: z.string({ required_error: 'client_request_id wajib diisi.' }).uuid('client_request_id harus UUID.'),
    case_type_code: z.string({ required_error: 'Tipe kasus wajib dipilih.' }).min(1),
    case_type_other: z.string().trim().max(100, 'Jenis kasus maksimal 100 karakter.').nullable().optional(),
    patient: z
      .object({
        use_self: z.boolean().default(false),
        patient_id: z.string().uuid().nullable().optional(),
        name: z.string().trim().max(100).nullable().optional(),
        name_unknown: z.boolean().default(false),
        identity_number: identitySchema.nullable().optional(),
        identity_unknown: z.boolean().default(false),
      })
      .superRefine((p, ctx) => {
        if (p.use_self || p.patient_id) return;
        if (!p.name_unknown && !p.name) ctx.addIssue({ code: 'custom', path: ['name'], message: 'Nama pasien wajib diisi.' });
        if (!p.identity_unknown && !p.identity_number) {
          ctx.addIssue({ code: 'custom', path: ['identity_number'], message: 'Identitas wajib diisi.' });
        }
      }),
    location: z.object({
      lat: latSchema,
      lng: lngSchema,
      address: z.string({ required_error: 'Lokasi wajib diisi.' }).trim().min(3, 'Lokasi wajib diisi.').max(500),
    }),
    description: z.string({ required_error: 'Deskripsi wajib diisi.' }).trim().min(3, 'Deskripsi wajib diisi.').max(1000, 'Deskripsi maksimal 1000 karakter.'),
  })
  .superRefine((v, ctx) => {
    if (v.case_type_code === 'LAINNYA' && !v.case_type_other) {
      ctx.addIssue({ code: 'custom', path: ['case_type_other'], message: 'Jenis kasus wajib diisi.' });
    }
  });

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const cancelSchema = z.object({ reason: z.string().trim().max(255).optional() });
