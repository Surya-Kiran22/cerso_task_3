/* eslint-disable no-console */

type Level = 'info' | 'warn' | 'error' | 'debug';

const LEVEL_WEIGHT: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_WEIGHT = process.env.NODE_ENV === 'test' ? LEVEL_WEIGHT.error : LEVEL_WEIGHT.debug;

function write(level: Level, message: string): void {
  if (LEVEL_WEIGHT[level] < MIN_WEIGHT) return;

  const stamp = new Date().toISOString();
  const line = `${stamp} [${level.toUpperCase()}] ${message}`;

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string) => write('debug', message),
  info: (message: string) => write('info', message),
  warn: (message: string) => write('warn', message),
  error: (message: string) => write('error', message),
};
