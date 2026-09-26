/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/tests'],
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  // `moduleResolution: node16` requires explicit `.js` extensions on relative
  // imports; map them back onto the TypeScript sources.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // Runs before the test framework and before any `src` import, so the config
  // module picks up the test database instead of the development one.
  setupFiles: ['<rootDir>/tests/env.setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts', '!src/types/**'],
  testTimeout: 30000,
  verbose: true,
};
