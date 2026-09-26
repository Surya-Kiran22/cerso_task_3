import type { Request, Response } from 'express';
import { getDatabaseStatus } from '../config/database';

/**
 * Liveness + readiness probe, shared by the root `/health` route and the
 * versioned `/api/v1/health` route so both report identical information.
 */
export const healthController = {
  check(_req: Request, res: Response): void {
    const db = getDatabaseStatus();

    res.status(db.healthy ? 200 : 503).json({
      success: db.healthy,
      data: {
        status: db.healthy ? 'ok' : 'degraded',
        database: db.state,
        uptime: Number(process.uptime().toFixed(3)),
        timestamp: new Date().toISOString(),
      },
    });
  },
};
