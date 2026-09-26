import { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from '../constants/task';
import type { Task } from '../types/task';

export interface TaskAttributes {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: Date | null;
  tags: string[];
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Instance methods available on every task document. */
export interface TaskMethods {
  /** Marks the task done and stamps `completedAt`. */
  markCompleted(): void;
  /** Reopens the task and clears `completedAt`. */
  markIncomplete(): void;
  /** True when the due date has passed and the task is not done. */
  isOverdue(now?: Date): boolean;
}

export type TaskDocument = HydratedDocument<TaskAttributes, TaskMethods>;
export type TaskModel = Model<TaskAttributes, Record<string, never>, TaskMethods>;

const taskSchema = new Schema<TaskAttributes, TaskModel, TaskMethods>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters long'],
      maxlength: [120, 'Title must be at most 120 characters long'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description must be at most 1000 characters long'],
      default: undefined,
    },
    status: {
      type: String,
      enum: {
        values: TASK_STATUSES as unknown as string[],
        message: 'Status must be one of: todo, in_progress, done',
      },
      default: 'todo',
      index: true,
    },
    priority: {
      type: String,
      enum: {
        values: TASK_PRIORITIES as unknown as string[],
        message: 'Priority must be one of: low, medium, high',
      },
      default: 'medium',
      index: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (tags: string[]) => tags.length <= 10,
        message: 'A task can have at most 10 tags',
      },
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: false, versionKey: false },
    toObject: { virtuals: false, versionKey: false },
  },
);

// Compound index powers the default "newest first, filtered by status" listing.
taskSchema.index({ status: 1, createdAt: -1 });
// Supports the `?search=` regex filter across title, description and tags.
taskSchema.index({ title: 1 });
taskSchema.index({ tags: 1 });

taskSchema.methods.markCompleted = function markCompleted(this: TaskDocument): void {
  this.set({ status: 'done', completedAt: new Date() });
};

taskSchema.methods.markIncomplete = function markIncomplete(this: TaskDocument): void {
  this.set({ status: 'todo', completedAt: null });
};

taskSchema.methods.isOverdue = function isOverdue(this: TaskDocument, now: Date = new Date()): boolean {
  return this.dueDate !== null && this.dueDate !== undefined && this.status !== 'done' && this.dueDate.getTime() < now.getTime();
};

export const TaskModel = model<TaskAttributes, TaskModel>('Task', taskSchema);

/** Maps a Mongoose document to the JSON shape returned by the API. */
export function serializeTask(doc: TaskDocument): Task {
  const obj = doc.toObject() as unknown as Record<string, unknown>;

  return {
    _id: String(obj._id),
    title: obj.title as string,
    ...(obj.description === undefined ? {} : { description: obj.description as string }),
    status: obj.status as TaskStatus,
    priority: obj.priority as TaskPriority,
    dueDate: obj.dueDate ? new Date(obj.dueDate as Date).toISOString() : null,
    tags: (obj.tags as string[]) ?? [],
    completedAt: obj.completedAt ? new Date(obj.completedAt as Date).toISOString() : null,
    isOverdue: doc.isOverdue(),
    createdAt: new Date(obj.createdAt as Date).toISOString(),
    updatedAt: new Date(obj.updatedAt as Date).toISOString(),
  };
}

export function serializeTasks(docs: TaskDocument[]): Task[] {
  return docs.map(serializeTask);
}
