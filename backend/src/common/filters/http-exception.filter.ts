import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'object' && (res as any).message ? (res as any).message : exception.message;
      if (Array.isArray(message)) {
        message = message.join(', ');
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      // Handle known domain checks as 400 Bad Request
      if (
        message.includes('reopen') ||
        message.includes('escalat') ||
        message.includes('active tickets') ||
        message.includes('Invalid') ||
        message.includes('not found') ||
        message.includes('not permitted') ||
        message.includes('already exists')
      ) {
        status = HttpStatus.BAD_REQUEST;
      }
    }

    this.logger.error(`[${status}] ${message}`, exception.stack);

    response.status(status).json({
      success: false,
      error: message,
      message: message,
      statusCode: status,
      timestamp: new Date().toISOString(),
    });
  }
}
