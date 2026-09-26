import { z } from 'zod';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  SORTABLE_TASK_FIELDS,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '../constants/task';

const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Must be a valid 24 character ObjectId');

/** Accepts an ISO-8601 date string (or `null` to clear the field). */
const isoDate = z
  .string()
  .datetime({ message: 'Must be a valid ISO-8601 date-time string (e.g. 2026-01-31T09:00:00.000Z)' })
  .transform((value) => new Date(value));

const tags = z
  .array(z.string().trim().min(1).max(30))
  .max(10, 'A task can have at most 10 tags')
  .transform((list) => [...new Set(list.map((t) => t.toLowerCase()))]);

/** POST /api/v1/tasks */
export const createTaskSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120, 'Title must be at most 120 characters'),
    description: z.string().trim().max(1000, 'Description must be at most 1000 characters').optional(),
    status: z.enum(TASK_STATUSES, { errorMap: () => ({ message: `Status must be one of: ${TASK_STATUSES.join(', ')}` }) }).optional(),
    priority: z.enum(TASK_PRIORITIES, { errorMap: () => ({ message: `Priority must be one of: ${TASK_PRIORITIES.join(', ')}` }) }).optional(),
    dueDate: isoDate.optional(),
    tags: tags.optional(),
  })
  .strict('Unknown fields are not allowed; remove them from the request body');

/** PATCH/PUT /api/v1/tasks/:id - every field optional, but at least one required. */
export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120, 'Title must be at most 120 characters').optional(),
    description: z.string().trim().max(1000, 'Description must be at most 1000 characters').optional(),
    status: z.enum(TASK_STATUSES, { errorMap: () => ({ message: `Status must be one of: ${TASK_STATUSES.join(', ')}` }) }).optional(),
    priority: z.enum(TASK_PRIORITIES, { errorMap: () => ({ message: `Priority must be one of: ${TASK_PRIORITIES.join(', ')}` }) }).optional(),
    dueDate: isoDate.nullable().optional(),
    tags: tags.optional(),
  })
  .strict('Unknown fields are not allowed; remove them from the request body')
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

/** GET /api/v1/tasks/:id and DELETE /api/v1/tasks/:id */
export const taskIdSchema = z.object({ id: objectId });

/** GET /api/v1/tasks */
export const listTasksQuerySchema = z
  .object({
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    search: z.string().trim().min(1).max(120).optional(),
    page: z.coerce.number().int().min(1, 'Page must be 1 or greater').default(1),
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE, `Limit must be ${MAX_PAGE_SIZE} or less`).default(DEFAULT_PAGE_SIZE),
    sortBy: z.enum(SORTABLE_TASK_FIELDS).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict('Unknown query parameters are not allowed');

export type CreateTaskBody = z.infer<typeof createTaskSchema>;
export type UpdateTaskBody = z.infer<typeof updateTaskSchema>;
export type TaskIdParams = z.infer<typeof taskIdSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
