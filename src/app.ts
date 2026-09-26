import express, { type Application, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { env } from './config/env';
import { healthController } from './controllers/health.controller';
import { errorHandler } from './middlewares/errorHandler';
import { notFoundHandler } from './middlewares/notFoundHandler';
import { requestLogger } from './middlewares/requestLogger';
import apiRoutes from './routes';
import { sendSuccess } from './utils/apiResponse';

/**
 * Locates index.html whether running from `src/` (tsx dev) or `dist/`
 * (compiled), since the HTML file is not emitted by tsc.
 */
function resolveIndexHtml(): string | null {
  const candidates = [
    path.resolve(__dirname, '..', 'index.html'),
    path.resolve(__dirname, '..', '..', 'index.html'),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

export function createApp(): Application {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: env.corsOrigins !== '*' }));
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use(requestLogger);

  // Liveness probe, mounted at the root so orchestrators do not need the prefix.
  app.get('/health', healthController.check);

  app.use(env.API_PREFIX, apiRoutes);

  // Serve the single-page test UI. Only this one file is exposed - the project
  // directory is NOT mounted statically, so .env and src/ stay unreachable.
  const indexHtml = resolveIndexHtml();
  if (indexHtml) {
    const sendUi = (_req: Request, res: Response): void => {
      res.sendFile(indexHtml);
    };
    app.get('/', sendUi);
    app.get('/index.html', sendUi);
  } else {
    app.get('/', (_req: Request, res: Response) => {
      sendSuccess(res, { name: 'Task Management API', version: '1.0.0', docs: `${env.API_PREFIX}/` });
    });
  }

  // Order matters: 404 first, then the single error handler last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
