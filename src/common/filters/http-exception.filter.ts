import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { ApiResponse } from '../dto/api-response.dto';
import { ApiException } from '../exceptions';

type ExceptionResponseObject = {
  message?: string | string[];
  error?: string;
  [key: string]: unknown;
};

/**
 * Global exception filter
 * Handles all exceptions and formats them as ApiResponseDto
 * Supports i18n for error messages
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly i18n: I18nService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode: string | undefined;
    let errorDetails: unknown;

    // Handle custom ApiException
    if (exception instanceof ApiException) {
      status = exception.getStatus();
      errorCode = exception.errorCode;

      // Try to get i18n message if i18nKey is provided
      if (exception.i18nKey) {
        try {
          // Get language from query param or Accept-Language header
          // Express normalizes headers to lowercase, so we check both formats
          const acceptLanguage =
            request.headers['accept-language'] ??
            request.headers['Accept-Language'] ??
            '';
          // Priority: Query param (override) > Accept-Language header > Default
          const acceptLanguageValue =
            acceptLanguage
              .toString()
              .split(',')[0]
              ?.trim()
              ?.split('-')[0]
              ?.toLowerCase() || '';
          const lang =
            (request.query?.lang as string) || // Query param can override header
            acceptLanguageValue ||
            'en';

          // Use the i18n key as-is if it already has a namespace (e.g., 'auth.errors.xxx')
          // Otherwise, prefix with 'common.' for common.json keys
          const hasNamespace = exception.i18nKey.includes('.');
          const i18nKey = hasNamespace
            ? exception.i18nKey
            : `common.${exception.i18nKey}`;

          message = await this.i18n.t(i18nKey, {
            args: exception.i18nArgs || {},
            lang,
          });
        } catch (error) {
          // Log error in development for debugging
          if (process.env.NODE_ENV !== 'production') {
            console.error('i18n translation failed:', {
              key: exception.i18nKey,
              error: error instanceof Error ? error.message : String(error),
            });
          }
          // Fallback to default message if i18n fails
          message = exception.message;
        }
      } else {
        message = exception.message;
      }

      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        errorDetails = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse
      ) {
        const responseObj = exceptionResponse as ExceptionResponseObject;
        errorDetails = responseObj.message;
      }
    }
    // Handle standard HttpException
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const responseObj = exceptionResponse as ExceptionResponseObject;
        const responseMessage = responseObj.message;

        if (typeof responseMessage === 'string') {
          // Try to translate if it looks like an i18n key
          if (responseMessage.includes('.') && !responseMessage.includes(' ')) {
            try {
              const acceptLanguage =
                request.headers['accept-language'] ??
                request.headers['Accept-Language'] ??
                '';
              // Priority: Query param (override) > Accept-Language header > Default
              const acceptLanguageValue =
                acceptLanguage
                  .toString()
                  .split(',')[0]
                  ?.trim()
                  ?.split('-')[0]
                  ?.toLowerCase() || '';
              const lang =
                (request.query?.lang as string) || // Query param can override header
                acceptLanguageValue ||
                'en';

              // Use the key as-is if it already has a namespace (e.g., 'auth.errors.xxx')
              // Otherwise, prefix with 'common.' for common.json keys
              const hasNamespace = responseMessage.includes('.');
              const i18nKey = hasNamespace
                ? responseMessage
                : `common.${responseMessage}`;
              message = await this.i18n.t(i18nKey, { lang });
            } catch {
              message = responseMessage;
            }
          } else {
            message = responseMessage;
          }
        } else if (Array.isArray(responseMessage)) {
          // Handle validation errors - translate each message
          try {
            const acceptLanguage =
              request.headers['accept-language'] ??
              request.headers['Accept-Language'] ??
              '';
            const lang =
              (request.query?.lang as string) ||
              acceptLanguage
                .toString()
                .split(',')[0]
                ?.trim()
                .split('-')[0]
                ?.toLowerCase() ||
              'en';

            const validationMessages: string[] = responseMessage.map((item) => {
              if (typeof item === 'string') {
                return item;
              }
              if (
                typeof item === 'object' &&
                item !== null &&
                'constraints' in item
              ) {
                const constraints = (
                  item as { constraints?: Record<string, string> }
                ).constraints;
                if (constraints && typeof constraints === 'object') {
                  const constraintValues = Object.values(constraints);
                  return constraintValues[0] ?? 'validation error';
                }
              }
              return 'validation error';
            });

            const translatedMessages = await Promise.all(
              validationMessages.map(async (msg: string) => {
                if (
                  typeof msg === 'string' &&
                  msg.includes('.') &&
                  !msg.includes(' ')
                ) {
                  try {
                    let i18nKey = msg;
                    if (msg.startsWith('validation.')) {
                      i18nKey = msg;
                    } else if (msg.startsWith('common.')) {
                      i18nKey = msg;
                    } else if (msg.includes('.')) {
                      i18nKey = msg;
                    } else {
                      i18nKey = `common.${msg}`;
                    }
                    return await this.i18n.t(i18nKey, { lang });
                  } catch {
                    return msg;
                  }
                }
                return msg;
              }),
            );

            errorDetails = translatedMessages;
            const i18nKey = 'common.errors.validationError';
            message = await this.i18n.t(i18nKey, { lang });
            errorCode =
              status === HttpStatus.BAD_REQUEST
                ? 'Bad Request'
                : 'VALIDATION_ERROR';
          } catch {
            errorDetails = responseMessage;
            message = 'Validation failed';
            errorCode =
              status === HttpStatus.BAD_REQUEST
                ? 'Bad Request'
                : 'VALIDATION_ERROR';
          }
        } else {
          message = exception.message;
        }

        if (typeof responseObj.error === 'string') {
          errorCode = responseObj.error;
        }
      } else {
        message = exception.message;
      }
    }
    // Handle unknown errors
    else if (exception instanceof Error) {
      message = exception.message;
      errorCode = 'INTERNAL_SERVER_ERROR';
    }

    // Log error in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('Exception caught:', {
        status,
        message,
        errorCode,
        errorDetails,
        path: request.url,
        method: request.method,
        exception: exception instanceof Error ? exception.stack : exception,
      });
    }

    // Send formatted response
    response
      .status(status)
      .json(ApiResponse.error(message, status, errorCode, errorDetails));
  }
}
