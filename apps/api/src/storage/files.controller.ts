import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { AppError } from '../common/app-error';
import { Public } from '../auth/auth.decorators';
import { StorageService } from './storage.service';

const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** Menyajikan berkas privat lewat URL bertanda tangan (docs/api_contract.md §7). */
@Public()
@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Get('*key')
  async get(@Param('key') key: string | string[], @Query('exp') exp: string, @Query('sig') sig: string, @Res() res: Response) {
    const objectKey = Array.isArray(key) ? key.join('/') : key;
    if (!sig || !this.storage.verify(objectKey, Number(exp), sig)) throw AppError.forbidden('Tautan berkas tidak valid atau kedaluwarsa.');
    let data: Buffer;
    try {
      data = await this.storage.read(objectKey);
    } catch {
      throw AppError.notFound('Berkas tidak ditemukan.');
    }
    res.setHeader('Content-Type', MIME[objectKey.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(data);
  }
}
