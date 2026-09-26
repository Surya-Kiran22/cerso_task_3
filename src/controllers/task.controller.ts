import type { Request, Response } from 'express';
import { taskService } from '../services/task.service';
import { buildPaginationMeta, sendSuccess } from '../utils/apiResponse';
import type {
  CreateTaskBody,
  ListTasksQuery,
  TaskIdParams,
  UpdateTaskBody,
} from '../validators/task.validator';

export const taskController = {
  /** POST /api/v1/tasks */
  async create(req: Request, res: Response): Promise<Response> {
    const task = await taskService.create(req.body as CreateTaskBody);
    return sendSuccess(res, task, 201, { message: 'Task created successfully' });
  },

  /** GET /api/v1/tasks */
  async list(req: Request, res: Response): Promise<Response> {
    const query = req.query as unknown as ListTasksQuery;
    const { tasks, total } = await taskService.findAll(query);
    return sendSuccess(res, tasks, 200, { pagination: buildPaginationMeta(total, query.page, query.limit) });
  },

  /** GET /api/v1/tasks/:id */
  async getById(req: Request, res: Response): Promise<Response> {
    const { id } = req.params as unknown as TaskIdParams;
    const task = await taskService.findById(id);
    return sendSuccess(res, task);
  },

  /** PATCH /api/v1/tasks/:id */
  async update(req: Request, res: Response): Promise<Response> {
    const { id } = req.params as unknown as TaskIdParams;
    const task = await taskService.update(id, req.body as UpdateTaskBody);
    return sendSuccess(res, task, 200, { message: 'Task updated successfully' });
  },

  /** DELETE /api/v1/tasks/:id */
  async remove(req: Request, res: Response): Promise<Response> {
    const { id } = req.params as unknown as TaskIdParams;
    const task = await taskService.remove(id);
    return sendSuccess(res, task, 200, { message: 'Task deleted successfully' });
  },

  /** GET /api/v1/tasks/stats */
  async stats(_req: Request, res: Response): Promise<Response> {
    const stats = await taskService.stats();
    return sendSuccess(res, stats);
  },
};
