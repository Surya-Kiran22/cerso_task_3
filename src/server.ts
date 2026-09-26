import type { Server } from 'node:http';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { env } from './config/env';
import { logger } from './utils/logger';

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function bootstrap(): Promise<void> {
  // Fail fast: never accept traffic without a working database.
  await connectDatabase();
  logger.info(`Database "${env.MONGODB_DB_NAME}" ready`);

  const app = createApp();
  const server: Server = app.listen(env.PORT, () => {
    logger.info(`Server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    logger.info(`API base URL: http://localhost:${env.PORT}${env.API_PREFIX}`);
  });

  let shuttingDown = false;

  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received - shutting down gracefully`);

    // Don't let a hung connection keep the process alive forever.
    const timer = setTimeout(() => {
      logger.error('Graceful shutdown timed out - forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    timer.unref();

    server.close(async (err) => {
      if (err) logger.error(`Error while closing HTTP server: ${err.message}`);
      try {
        await disconnectDatabase();
        clearTimeout(timer);
        process.exit(err ? 1 : 0);
      } catch (dbErr) {
        logger.error(`Error while closing database connection: ${(dbErr as Error).message}`);
        process.exit(1);
      }
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled promise rejection: ${(reason as Error)?.stack ?? String(reason)}`);
    shutdown('unhandledRejection');
  });
  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught exception: ${err.stack ?? err.message}`);
    process.exit(1);
  });
}

bootstrap().catch((err: unknown) => {
  logger.error(`Failed to start server: ${(err as Error).message}`);
  process.exit(1);
});
