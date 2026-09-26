import { Router } from 'express';
import { healthController } from '../controllers/health.controller';
import taskRoutes from './task.routes';

const router = Router();

/** Liveness + readiness probe: reports both process and database state. */
router.get('/health', healthController.check);

/** Convenience index of the available endpoints. */
router.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      name: 'Task Management API',
      version: '1.0.0',
      endpoints: {
        health: 'GET /health',
        createTask: 'POST /tasks',
        listTasks: 'GET /tasks',
        taskStats: 'GET /tasks/stats',
        getTask: 'GET /tasks/:id',
        updateTask: 'PATCH /tasks/:id',
        deleteTask: 'DELETE /tasks/:id',
      },
    },
  });
});

router.use('/tasks', taskRoutes);

export default router;
