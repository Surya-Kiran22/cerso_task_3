/**
 * Runs before any application module is imported, so `src/config/env.ts`
 * validates against the test environment.
 */
process.env.NODE_ENV = 'test';
process.env.MONGODB_DB_NAME = process.env.MONGODB_DB_NAME ?? 'task_management_test';
process.env.LOG_FORMAT = 'tiny';
process.env.CORS_ORIGIN = '*';

if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017';
}
