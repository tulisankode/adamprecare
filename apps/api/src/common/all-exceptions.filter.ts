import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { MulterError } from 'multer';
import { AppError, ErrorCode } from './app-error';

interface ErrorBody {
  code: ErrorCode;
  message: string;
  details?: { field: string; message: string }[];
}

/** Menyeragamkan semua error ke format `{ error: { code, message, details } }`. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') return;
    const res = host.switchToHttp().getResponse<Response>();
    const [status, body] = this.toBody(exception);
    if (status >= 500) this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(status).json({ error: body });
  }

  private toBody(exception: unknown): [number, ErrorBody] {
    if (exception instanceof AppError) {
      return [exception.getStatus(), { code: exception.code, message: exception.message, details: exception.details }];
    }
    if (exception instanceof ThrottlerException) {
      return [HttpStatus.TOO_MANY_REQUESTS, { code: 'RATE_LIMITED', message: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' }];
    }
    if (exception instanceof MulterError) {
      const message = exception.code === 'LIMIT_FILE_SIZE' ? 'Ukuran foto maksimal 5 MB.' : 'Berkas tidak valid.';
      return [HttpStatus.BAD_REQUEST, { code: 'VALIDATION_ERROR', message, details: [{ field: exception.field ?? 'photo', message }] }];
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return [HttpStatus.CONFLICT, { code: 'DUPLICATE', message: 'Data sudah terdaftar.' }];
      }
      if (exception.code === 'P2025') {
        return [HttpStatus.NOT_FOUND, { code: 'NOT_FOUND', message: 'Data tidak ditemukan.' }];
      }
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code: ErrorCode =
        status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : status < 500 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR';
      const message = status === 404 ? 'Endpoint tidak ditemukan.' : exception.message;
      return [status, { code, message }];
    }
    return [HttpStatus.INTERNAL_SERVER_ERROR, { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server.' }];
  }
}
