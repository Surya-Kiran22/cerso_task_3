import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

mongoose.set('strictQuery', true);

let connectionPromise: Promise<typeof mongoose> | null = null;

/**
 * Opens (and reuses) the shared Mongoose connection.
 *
 * Mongoose keeps an internal connection pool, so calling this more than once is
 * cheap - the second call resolves with the already-open connection.
 */
export async function connectDatabase(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  if (connectionPromise) return connectionPromise;

  mongoose.connection.on('connected', () => logger.info('MongoDB connection established'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB connection lost'));
  mongoose.connection.on('error', (err: Error) => logger.error(`MongoDB connection error: ${err.message}`));

  connectionPromise = mongoose
    .connect(uri, {
      dbName: env.MONGODB_DB_NAME,
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
    })
    .then((m) => m)
    .catch((err: unknown) => {
      // Allow a later retry instead of caching a rejected promise forever.
      connectionPromise = null;
      throw err;
    });

  return connectionPromise;
}

/** Closes the connection. Safe to call when nothing is connected. */
export async function disconnectDatabase(): Promise<void> {
  connectionPromise = null;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('MongoDB connection closed');
  }
}

/** Cheap liveness probe used by the health-check route. */
export function getDatabaseStatus(): {
  state: 'disconnected' | 'connected' | 'connecting' | 'disconnecting' | 'uninitialized';
  healthy: boolean;
} {
  const readyState = mongoose.connection.readyState;
  let state: ReturnType<typeof getDatabaseStatus>['state'];

  switch (readyState) {
    case 0:
      state = 'disconnected';
      break;
    case 1:
      state = 'connected';
      break;
    case 2:
      state = 'connecting';
      break;
    case 3:
      state = 'disconnecting';
      break;
    default:
      state = 'uninitialized';
  }

  return { state, healthy: readyState === 1 };
}
