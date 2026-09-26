import type { RequestHandler } from 'express';
import morgan from 'morgan';
import { env } from '../config/env';

const formats = {
  dev: ':method :url :status :response-time ms - :res[content-length]',
  tiny: ':method :url :status :response-time ms',
  // Expanded from morgan's built-in 'combined' format. The bare string
  // 'combined' cannot be used as a template: morgan would parse it as the
  // token ':combined', which does not exist and throws on every response.
  combined:
    ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" ' +
    ':status :res[content-length] ":referrer" ":user-agent"',
} as const;

const activeFormat: string = formats[env.LOG_FORMAT] ?? formats.dev;

/** Request logging middleware. */
export const requestLogger: RequestHandler = morgan(activeFormat, {
  // Health checks would otherwise flood the log.
  skip: (req) => req.originalUrl === '/health' || req.originalUrl === `${env.API_PREFIX}/health`,
});
