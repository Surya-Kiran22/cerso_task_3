/** Lifecycle states a task can be in. */
export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** Human readable labels, handy for UIs and API documentation. */
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

export const SORTABLE_TASK_FIELDS = ['createdAt', 'updatedAt', 'dueDate', 'priority', 'status', 'title'] as const;
export type SortableTaskField = (typeof SORTABLE_TASK_FIELDS)[number];

/** Upper bound for `limit` so a client cannot request an unbounded result set. */
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 10;
