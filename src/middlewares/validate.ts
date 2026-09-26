import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { ApiError } from '../utils/ApiError';

export interface ValidationTargets {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

function formatIssues(error: ZodError): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

/**
 * Validates and *replaces* the incoming `body` / `params` / `query` with the
 * parsed result, so controllers always receive coerced, trimmed, known data.
 */
export function validate(targets: ValidationTargets) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (targets.body) req.body = targets.body.parse(req.body);
      if (targets.params) req.params = targets.params.parse(req.params) as typeof req.params;
      if (targets.query) {
        const parsed = targets.query.parse(req.query) as Record<string, unknown>;
        // Express 5 exposes `query` as a lazy getter, so assign defensively.
        Object.defineProperty(req, 'query', { value: parsed, writable: true, configurable: true });
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(ApiError.validation('Request validation failed', formatIssues(error)));
        return;
      }
      next(error);
    }
  };
}
