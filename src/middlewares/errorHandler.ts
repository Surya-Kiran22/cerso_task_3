import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { sendError } from '../utils/apiResponse';
import { logger } from '../utils/logger';

/** Anything with a `statusCode` is treated as a client-facing error. */
interface MaybeOperational {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
  message: string;
  details?: unknown;
}

function isOperationalError(err: unknown): err is MaybeOperational {
  return typeof err === 'object' && err !== null && (err as MaybeOperational).isOperational === true;
}

/** Translates a Mongoose `ValidationError` into a 422 with field level details. */
function fromMongooseValidationError(err: mongoose.Error.ValidationError): ApiError {
  const details = Object.values(err.errors).map((e) => ({
    field: e.path,
    message: e.message,
  }));
  return ApiError.validation('Validation failed', details);
}

/** Translates a duplicate-key (E11000) error into a 409. */
function fromDuplicateKeyError(err: mongoose.Error.MongooseServerSelectionError | { code?: number; keyValue?: unknown }): ApiError | null {
  if ((err as { code?: number }).code === 11000) {
    return ApiError.conflict('A record with the same unique value already exists', 'DUPLICATE_KEY', (err as { keyValue?: unknown }).keyValue);
  }
  return null;
}

/** Shape of errors raised by body-parser / http-errors before our routes run. */
interface HttpLikeError {
  status?: number;
  statusCode?: number;
  message: string;
  expose?: boolean;
  type?: string;
}

/**
 * Detects 4xx errors produced by Express middleware itself (malformed JSON,
 * payload too large, unsupported content type). These are the client's fault and
 * must not be reported as 500.
 */
function isClientHttpError(err: unknown): err is HttpLikeError {
  if (typeof err !== 'object' || err === null) return false;
  const candidate = err as HttpLikeError;
  const status = candidate.status ?? candidate.statusCode;
  return typeof status === 'number' && status >= 400 && status < 500;
}

function fromClientHttpError(err: HttpLikeError): ApiError {
  const status = err.status ?? err.statusCode ?? 400;
  const code = err.type === 'entity.parse.failed' ? 'INVALID_JSON' : err.type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST';
  // Deliberately does not echo `err.body` back, which would reflect user input.
  return new ApiError(status, err.expose === false ? 'Bad request' : err.message || 'Bad request', code);
}

/**
 * Single Express error handler. Must be registered last.
 *
 * Anything that is not an explicitly thrown `ApiError` is logged in full and
 * reported to the client as a generic 500 so internal details never leak.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) {
    logger.error(`Response already sent for ${req.method} ${req.originalUrl}: ${(err as Error)?.message}`);
    return;
  }

  let apiError: ApiError;

  if (err instanceof ApiError) {
    apiError = err;
  } else if (err instanceof mongoose.Error.ValidationError) {
    apiError = fromMongooseValidationError(err);
  } else if (err instanceof mongoose.Error.CastError) {
    apiError = ApiError.badRequest(`Invalid value for "${err.path}"`, 'INVALID_IDENTIFIER');
  } else if (err instanceof ZodError) {
    apiError = ApiError.validation('Request validation failed', err.issues);
  } else if (isClientHttpError(err)) {
    apiError = fromClientHttpError(err);
  } else {
    const duplicate = fromDuplicateKeyError(err as { code?: number });
    if (duplicate) {
      apiError = duplicate;
    } else {
      // Unexpected: log everything, tell the client nothing.
      logger.error(`Unhandled error on ${req.method} ${req.originalUrl}: ${(err as Error)?.stack ?? String(err)}`);
      apiError = ApiError.internal();
    }
  }

  if (apiError.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${apiError.statusCode} ${apiError.message}`);
  }

  sendError(
    res,
    apiError.statusCode,
    apiError.code,
    // Never leak internals of unexpected errors outside development.
    env.isProduction && apiError.statusCode >= 500 ? 'Internal server error' : apiError.message,
    apiError.details,
  );
}
