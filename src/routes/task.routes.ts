import { Router } from 'express';
import { taskController } from '../controllers/task.controller';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  createTaskSchema,
  listTasksQuerySchema,
  taskIdSchema,
  updateTaskSchema,
} from '../validators/task.validator';

const router = Router();

// GET /api/v1/tasks/stats  (declared before "/:id" so "stats" is not read as an id)
router.get('/stats', asyncHandler(taskController.stats));

// GET /api/v1/tasks
router.get('/', validate({ query: listTasksQuerySchema }), asyncHandler(taskController.list));

// GET /api/v1/tasks/:id
router.get('/:id', validate({ params: taskIdSchema }), asyncHandler(taskController.getById));

// POST /api/v1/tasks
router.post('/', validate({ body: createTaskSchema }), asyncHandler(taskController.create));

// PATCH /api/v1/tasks/:id  (partial update)
router.patch(
  '/:id',
  validate({ params: taskIdSchema, body: updateTaskSchema }),
  asyncHandler(taskController.update),
);

// PUT /api/v1/tasks/:id  (full update; identical rules, kept for REST completeness)
router.put(
  '/:id',
  validate({ params: taskIdSchema, body: updateTaskSchema }),
  asyncHandler(taskController.update),
);

// DELETE /api/v1/tasks/:id
router.delete('/:id', validate({ params: taskIdSchema }), asyncHandler(taskController.remove));

export default router;
