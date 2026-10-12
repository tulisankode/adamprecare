import { ageText, dateList, jakartaDate, jakartaRange, mask } from './format';
import { normalizePhone } from './validators';

describe('format', () => {
  it('ageText mengikuti data yang tersedia', () => {
    const now = new Date('2026-10-12T00:00:00Z');
    expect(ageText(new Date('2006-07-07T00:00:00Z'), null, now)).toBe('20Th 3Bln 5Hr');
    expect(ageText(null, 20, now)).toBe('20 Th');
    expect(ageText(null, null, now)).toBe('-');
  });

  it('rentang tanggal memakai zona WIB dan inklusif', () => {
    const r = jakartaRange('2026-10-01', '2026-10-31');
    expect(r.gte?.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(r.lt?.toISOString()).toBe('2026-10-31T17:00:00.000Z');
    expect(jakartaDate(new Date('2026-10-11T18:30:00Z'))).toBe('2026-10-12');
    expect(dateList('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });

  it('menyamarkan nomor', () => {
    expect(mask('3578010101900002')).toBe('3578********0002');
    expect(mask(null)).toBeNull();
  });

  it('normalisasi nomor HP Indonesia', () => {
    expect(normalizePhone('0812-3456-7890')).toBe('+6281234567890');
    expect(normalizePhone('6281234567890')).toBe('+6281234567890');
    expect(normalizePhone('+6281234567890')).toBe('+6281234567890');
    expect(normalizePhone('12345')).toBeNull();
  });
});
