import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';

/** Terminal 404 handler for unmatched routes. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
}
