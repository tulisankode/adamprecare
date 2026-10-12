import { HttpException, HttpStatus } from '@nestjs/common';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'PHONE_NOT_VERIFIED'
  | 'NOT_FOUND'
  | 'ACTIVE_REQUEST_EXISTS'
  | 'ALREADY_TAKEN'
  | 'INVALID_STATUS_TRANSITION'
  | 'DUPLICATE'
  | 'OTP_INVALID'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ErrorDetail {
  field: string;
  message: string;
}

/** Error aplikasi dengan kode stabil sesuai docs/api_contract.md §1.2. */
export class AppError extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    status: HttpStatus,
    readonly details?: ErrorDetail[],
  ) {
    super({ code, message, details }, status);
  }

  static validation(message: string, details?: ErrorDetail[]) {
    return new AppError('VALIDATION_ERROR', message, HttpStatus.BAD_REQUEST, details);
  }

  static field(field: string, message: string) {
    return AppError.validation('Data tidak valid.', [{ field, message }]);
  }

  static unauthenticated(message = 'Sesi Anda telah berakhir. Silakan login kembali.') {
    return new AppError('UNAUTHENTICATED', message, HttpStatus.UNAUTHORIZED);
  }

  static invalidCredentials(message = 'Username/email/nomor HP atau password salah.') {
    return new AppError('INVALID_CREDENTIALS', message, HttpStatus.UNAUTHORIZED);
  }

  static forbidden(message = 'Anda tidak memiliki akses.') {
    return new AppError('FORBIDDEN', message, HttpStatus.FORBIDDEN);
  }

  static notFound(message = 'Data tidak ditemukan.') {
    return new AppError('NOT_FOUND', message, HttpStatus.NOT_FOUND);
  }

  static conflict(code: Extract<ErrorCode, 'ACTIVE_REQUEST_EXISTS' | 'ALREADY_TAKEN' | 'INVALID_STATUS_TRANSITION' | 'DUPLICATE'>, message: string, details?: ErrorDetail[]) {
    return new AppError(code, message, HttpStatus.CONFLICT, details);
  }
}
