import express, { type Application, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { healthController } from './controllers/health.controller';
import { errorHandler } from './middlewares/errorHandler';
import { notFoundHandler } from './middlewares/notFoundHandler';
import { requestLogger } from './middlewares/requestLogger';
import apiRoutes from './routes';
import { sendSuccess } from './utils/apiResponse';

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

  app.get('/', (_req: Request, res: Response) => {
    sendSuccess(res, { name: 'Task Management API', version: '1.0.0', docs: `${env.API_PREFIX}/` });
  });

  // Order matters: 404 first, then the single error handler last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
