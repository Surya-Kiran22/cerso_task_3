import type { FilterQuery, SortOrder } from 'mongoose';
import { TaskModel, serializeTask, serializeTasks, type TaskAttributes } from '../models/task.model';
import { ApiError } from '../utils/ApiError';
import type { CreateTaskInput, ListTasksQuery, Task, UpdateTaskInput } from '../types/task';

function buildFilter(query: Partial<ListTasksQuery>): FilterQuery<TaskAttributes> {
  const filter: FilterQuery<TaskAttributes> = {};

  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.search) {
    // Escaped so user input is treated as a literal substring, not a regex.
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escaped, 'i');
    filter.$or = [{ title: pattern }, { description: pattern }, { tags: pattern }];
  }

  return filter;
}

export const taskService = {
  async create(input: CreateTaskInput): Promise<Task> {
    const doc = await TaskModel.create({
      ...input,
      // Keep `completedAt` consistent with the initial status.
      completedAt: input.status === 'done' ? new Date() : null,
    });
    return serializeTask(doc);
  },

  async findAll(query: ListTasksQuery): Promise<{ tasks: Task[]; total: number }> {
    const filter = buildFilter(query);
    const sort: Record<string, SortOrder> = { [query.sortBy]: query.sortOrder };
    const skip = (query.page - 1) * query.limit;

    const [docs, total] = await Promise.all([
      TaskModel.find(filter).sort(sort).skip(skip).limit(query.limit).exec(),
      TaskModel.countDocuments(filter).exec(),
    ]);

    return { tasks: serializeTasks(docs), total };
  },

  async findById(id: string): Promise<Task> {
    const doc = await TaskModel.findById(id).exec();
    if (!doc) throw ApiError.notFound(`Task with id "${id}" was not found`, 'TASK_NOT_FOUND');
    return serializeTask(doc);
  },

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    const doc = await TaskModel.findById(id).exec();
    if (!doc) throw ApiError.notFound(`Task with id "${id}" was not found`, 'TASK_NOT_FOUND');

    if (input.title !== undefined) doc.title = input.title;
    if (input.description !== undefined) doc.description = input.description;
    if (input.priority !== undefined) doc.priority = input.priority;
    if (input.dueDate !== undefined) doc.dueDate = input.dueDate === null ? null : new Date(input.dueDate);
    if (input.tags !== undefined) doc.tags = input.tags;

    if (input.status !== undefined && input.status !== doc.status) {
      if (input.status === 'done') {
        doc.markCompleted();
      } else {
        doc.markIncomplete();
      }
    }

    await doc.save();
    return serializeTask(doc);
  },

  async remove(id: string): Promise<Task> {
    const doc = await TaskModel.findByIdAndDelete(id).exec();
    if (!doc) throw ApiError.notFound(`Task with id "${id}" was not found`, 'TASK_NOT_FOUND');
    return serializeTask(doc);
  },

  /** Aggregated counts, used by the `/tasks/stats` endpoint. */
  async stats(): Promise<{ total: number; byStatus: Record<string, number>; byPriority: Record<string, number> }> {
    const [byStatus, byPriority, total] = await Promise.all([
      TaskModel.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]).exec(),
      TaskModel.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$priority', count: { $sum: 1 } } }]).exec(),
      TaskModel.countDocuments().exec(),
    ]);

    const toRecord = (rows: Array<{ _id: string; count: number }>) =>
      rows.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row._id]: row.count }), {});

    return { total, byStatus: toRecord(byStatus), byPriority: toRecord(byPriority) };
  },
};
