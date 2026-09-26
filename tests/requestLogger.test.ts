/**
 * Guards a production-only crash: every value of LOG_FORMAT must produce a
 * working morgan format string. The original suite only ever ran with the
 * 'dev' format, so a broken 'combined' template shipped undetected and threw
 * `tokens.combined is not a function` on the first response in production.
 *
 * Uses a 404 probe on purpose: morgan formats when the response finishes, so any
 * route exercises the template, and this one needs no database connection.
 */
import request from 'supertest';

const FORMATS = ['dev', 'tiny', 'combined'] as const;

describe('requestLogger', () => {
  const originalFormat = process.env.LOG_FORMAT;

  afterEach(() => {
    if (originalFormat === undefined) delete process.env.LOG_FORMAT;
    else process.env.LOG_FORMAT = originalFormat;
    jest.resetModules();
  });

  it.each(FORMATS)('completes the response with LOG_FORMAT=%s', async (format) => {
    process.env.LOG_FORMAT = format;
    jest.resetModules();

    // Imported after LOG_FORMAT is set, because the format is resolved at import time.
    const { createApp } = await import('../src/app.js');

    const res = await request(createApp()).get('/__logger_probe__');

    expect(res.status).toBe(404);
  });
});
