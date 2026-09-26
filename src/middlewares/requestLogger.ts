import type { RequestHandler } from 'express';
import morgan from 'morgan';
import { env } from '../config/env';

const formats = {
  dev: ':method :url :status :response-time ms - :res[content-length]',
  tiny: ':method :url :status :response-time ms',
  combined: ':combined',
} as const;

const activeFormat: string = formats[env.LOG_FORMAT] ?? formats.dev;

/** Request logging middleware. */
export const requestLogger: RequestHandler = morgan(activeFormat, {
  // Health checks would otherwise flood the log.
  skip: (req) => req.originalUrl === '/health' || req.originalUrl === `${env.API_PREFIX}/health`,
});
