import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../src/app';
import { env } from '../src/config/env';

let app: Application;
const base = (): string => env.API_PREFIX;

beforeAll(() => {
  app = createApp();
});

/** Creates a task through the API and returns the created body. */
async function createTask(overrides: Record<string, unknown> = {}): Promise<Record<string, any>> {
  const res = await request(app)
    .post(`${base()}/tasks`)
    .send({ title: 'Default task', ...overrides })
    .expect(201);
  return res.body.data as Record<string, any>;
}

describe('Health check', () => {
  it('GET /health reports the service and database as healthy', async () => {
    const res = await request(app).get('/health').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.database).toBe('connected');
  });

  it('GET /api/v1/health reports identical information', async () => {
    const res = await request(app).get(`${base()}/health`).expect(200);

    expect(res.body.data).toMatchObject({ status: 'ok', database: 'connected' });
  });

  it('GET /api/v1 exposes the endpoint index', async () => {
    const res = await request(app).get(base()).expect(200);
    expect(res.body.data.endpoints.createTask).toBe('POST /tasks');
  });
});

describe('POST /api/v1/tasks  (Create)', () => {
  it('creates a task and applies schema defaults', async () => {
    const res = await request(app)
      .post(`${base()}/tasks`)
      .send({ title: 'Write the integration tests' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      title: 'Write the integration tests',
      status: 'todo',
      priority: 'medium',
      tags: [],
      completedAt: null,
      isOverdue: false,
    });
    expect(res.body.data._id).toMatch(/^[a-f\d]{24}$/i);
    expect(res.body.data.createdAt).toBeDefined();
    expect(res.body.data.updatedAt).toBeDefined();
  });

  it('stores every optional field that was supplied', async () => {
    const dueDate = new Date('2030-01-31T09:00:00.000Z').toISOString();
    const res = await request(app)
      .post(`${base()}/tasks`)
      .send({
        title: 'Ship the release',
        description: 'Tag, build and publish.',
        status: 'in_progress',
        priority: 'high',
        dueDate,
        tags: ['Release', 'release', 'Ops'],
      })
      .expect(201);

    const { data } = res.body;
    expect(data.description).toBe('Tag, build and publish.');
    expect(data.status).toBe('in_progress');
    expect(data.priority).toBe('high');
    expect(data.dueDate).toBe(dueDate);
    // Tags are lower-cased and de-duplicated.
    expect(data.tags).toEqual(['release', 'ops']);
  });

  it('stamps completedAt when a task is created directly as done', async () => {
    const res = await request(app)
      .post(`${base()}/tasks`)
      .send({ title: 'Already finished', status: 'done' })
      .expect(201);

    expect(res.body.data.status).toBe('done');
    expect(res.body.data.completedAt).not.toBeNull();
  });

  it('flags a past due date on an unfinished task as overdue', async () => {
    const res = await request(app)
      .post(`${base()}/tasks`)
      .send({ title: 'Overdue thing', dueDate: '2020-01-01T00:00:00.000Z' })
      .expect(201);

    expect(res.body.data.isOverdue).toBe(true);
  });

  describe('input validation', () => {
    it('rejects a missing title with 422', async () => {
      const res = await request(app).post(`${base()}/tasks`).send({ description: 'no title' }).expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'title' })]),
      );
    });

    it('rejects a title shorter than 3 characters', async () => {
      const res = await request(app).post(`${base()}/tasks`).send({ title: 'ab' }).expect(422);
      expect(res.body.error.details[0].message).toMatch(/at least 3 characters/i);
    });

    it('rejects an unknown status value', async () => {
      const res = await request(app)
        .post(`${base()}/tasks`)
        .send({ title: 'Bad status', status: 'archived' })
        .expect(422);

      expect(res.body.error.details[0].message).toMatch(/todo, in_progress, done/);
    });

    it('rejects a malformed date', async () => {
      const res = await request(app)
        .post(`${base()}/tasks`)
        .send({ title: 'Bad date', dueDate: 'not-a-date' })
        .expect(422);
      expect(res.body.error.details[0].field).toBe('dueDate');
    });

    it('rejects unknown body fields', async () => {
      const res = await request(app)
        .post(`${base()}/tasks`)
        .send({ title: 'Extra field', hacker: 'payload' })
        .expect(422);
      expect(res.body.error.details[0].message).toMatch(/unknown fields/i);
    });

    it('rejects more than 10 tags', async () => {
      const res = await request(app)
        .post(`${base()}/tasks`)
        .send({ title: 'Too many tags', tags: Array.from({ length: 11 }, (_, i) => `t${i}`) })
        .expect(422);
      expect(res.body.error.details[0].message).toMatch(/at most 10 tags/i);
    });
  });
});

describe('GET /api/v1/tasks  (Read / list)', () => {
  beforeEach(async () => {
    await Promise.all([
      createTask({ title: 'Alpha report', status: 'todo', priority: 'high' }),
      createTask({ title: 'Beta migration', status: 'in_progress', priority: 'low' }),
      createTask({ title: 'Gamma cleanup', status: 'done', priority: 'medium' }),
    ]);
  });

  it('returns all tasks newest first with pagination metadata', async () => {
    const res = await request(app).get(`${base()}/tasks`).expect(200);

    expect(res.body.data).toHaveLength(3);
    expect(res.body.meta.pagination).toMatchObject({
      total: 3,
      page: 1,
      limit: 10,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
  });

  it('filters by status', async () => {
    const res = await request(app).get(`${base()}/tasks?status=in_progress`).expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Beta migration');
  });

  it('filters by priority', async () => {
    const res = await request(app).get(`${base()}/tasks?priority=high`).expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Alpha report');
  });

  it('searches across the title', async () => {
    const res = await request(app).get(`${base()}/tasks?search=migrat`).expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Beta migration');
  });

  it('treats regex metacharacters in search as literal text', async () => {
    await createTask({ title: 'Literal .* task' });
    const res = await request(app).get(`${base()}/tasks?search=.*`).expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Literal .* task');
  });

  it('paginates results', async () => {
    const res = await request(app).get(`${base()}/tasks?page=2&limit=2`).expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.pagination).toMatchObject({ page: 2, limit: 2, hasPrevPage: true, total: 3 });
  });

  it('sorts ascending by title when requested', async () => {
    const res = await request(app).get(`${base()}/tasks?sortBy=title&sortOrder=asc`).expect(200);
    expect(res.body.data.map((t: { title: string }) => t.title)).toEqual([
      'Alpha report',
      'Beta migration',
      'Gamma cleanup',
    ]);
  });

  it('rejects an unsupported sort field with 422', async () => {
    const res = await request(app).get(`${base()}/tasks?sortBy=password`).expect(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown query parameter with 422', async () => {
    const res = await request(app).get(`${base()}/tasks?dropDatabase=true`).expect(422);
    expect(res.body.error.details[0].message).toMatch(/unknown query parameters/i);
  });

  it('rejects a non-numeric page with 422', async () => {
    const res = await request(app).get(`${base()}/tasks?page=abc`).expect(422);
    expect(res.body.error.details[0].field).toBe('page');
  });
});

describe('GET /api/v1/tasks/:id  (Read / single)', () => {
  it('returns the requested task', async () => {
    const created = await createTask({ title: 'Findable task' });
    const res = await request(app).get(`${base()}/tasks/${created._id}`).expect(200);

    expect(res.body.data._id).toBe(created._id);
    expect(res.body.data.title).toBe('Findable task');
  });

  it('returns 404 for an id that does not exist', async () => {
    const res = await request(app).get(`${base()}/tasks/64b7f9c2e13a4b5c6d7e8f90`).expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TASK_NOT_FOUND');
  });

  it('returns 422 for a malformed id', async () => {
    const res = await request(app).get(`${base()}/tasks/not-an-object-id`).expect(422);
    expect(res.body.error.details[0].message).toMatch(/valid 24 character ObjectId/i);
  });
});

describe('PATCH /api/v1/tasks/:id  (Update)', () => {
  it('updates the supplied fields and leaves the rest untouched', async () => {
    const created = await createTask({ title: 'Original title', description: 'Original description' });

    const res = await request(app)
      .patch(`${base()}/tasks/${created._id}`)
      .send({ title: 'Updated title' })
      .expect(200);

    expect(res.body.data.title).toBe('Updated title');
    expect(res.body.data.description).toBe('Original description');
    expect(res.body.data.updatedAt >= created.updatedAt).toBe(true);
  });

  it('sets completedAt when the status moves to done', async () => {
    const created = await createTask({ title: 'Finish me' });

    const res = await request(app)
      .patch(`${base()}/tasks/${created._id}`)
      .send({ status: 'done' })
      .expect(200);

    expect(res.body.data.status).toBe('done');
    expect(res.body.data.completedAt).not.toBeNull();
  });

  it('clears completedAt when a done task is reopened', async () => {
    const created = await createTask({ title: 'Reopen me', status: 'done' });

    const res = await request(app)
      .patch(`${base()}/tasks/${created._id}`)
      .send({ status: 'todo' })
      .expect(200);

    expect(res.body.data.status).toBe('todo');
    expect(res.body.data.completedAt).toBeNull();
  });

  it('accepts null to clear the due date', async () => {
    const created = await createTask({ title: 'Has a deadline', dueDate: '2030-05-05T00:00:00.000Z' });

    const res = await request(app)
      .patch(`${base()}/tasks/${created._id}`)
      .send({ dueDate: null })
      .expect(200);

    expect(res.body.data.dueDate).toBeNull();
  });

  it('rejects an empty update payload with 422', async () => {
    const created = await createTask();
    const res = await request(app).patch(`${base()}/tasks/${created._id}`).send({}).expect(422);

    expect(res.body.error.details[0].message).toMatch(/at least one field/i);
  });

  it('rejects an invalid field value with 422', async () => {
    const created = await createTask();
    const res = await request(app)
      .patch(`${base()}/tasks/${created._id}`)
      .send({ priority: 'urgent' })
      .expect(422);
    expect(res.body.error.details[0].field).toBe('priority');
  });

  it('returns 404 when updating a task that does not exist', async () => {
    const res = await request(app)
      .patch(`${base()}/tasks/64b7f9c2e13a4b5c6d7e8f90`)
      .send({ title: 'Nothing here' })
      .expect(404);
    expect(res.body.error.code).toBe('TASK_NOT_FOUND');
  });
});

describe('PUT /api/v1/tasks/:id  (Update, full)', () => {
  it('behaves like PATCH', async () => {
    const created = await createTask({ title: 'Put target' });

    const res = await request(app)
      .put(`${base()}/tasks/${created._id}`)
      .send({ priority: 'low' })
      .expect(200);

    expect(res.body.data.priority).toBe('low');
  });
});

describe('DELETE /api/v1/tasks/:id  (Delete)', () => {
  it('deletes the task and returns the deleted document', async () => {
    const created = await createTask({ title: 'Delete me' });

    const res = await request(app).delete(`${base()}/tasks/${created._id}`).expect(200);

    expect(res.body.data._id).toBe(created._id);
    expect(res.body.meta.message).toMatch(/deleted/i);
  });

  it('no longer returns the task afterwards', async () => {
    const created = await createTask();
    await request(app).delete(`${base()}/tasks/${created._id}`).expect(200);

    await request(app).get(`${base()}/tasks/${created._id}`).expect(404);
    const list = await request(app).get(`${base()}/tasks`).expect(200);
    expect(list.body.meta.pagination.total).toBe(0);
  });

  it('returns 404 when deleting the same task twice', async () => {
    const created = await createTask();
    await request(app).delete(`${base()}/tasks/${created._id}`).expect(200);

    const res = await request(app).delete(`${base()}/tasks/${created._id}`).expect(404);
    expect(res.body.error.code).toBe('TASK_NOT_FOUND');
  });

  it('returns 422 for a malformed id', async () => {
    await request(app).delete(`${base()}/tasks/12345`).expect(422);
  });
});

describe('GET /api/v1/tasks/stats', () => {
  it('aggregates counts by status and priority', async () => {
    await Promise.all([
      createTask({ status: 'todo', priority: 'high' }),
      createTask({ status: 'todo', priority: 'low' }),
      createTask({ status: 'done', priority: 'low' }),
    ]);

    const res = await request(app).get(`${base()}/tasks/stats`).expect(200);

    expect(res.body.data.total).toBe(3);
    expect(res.body.data.byStatus).toEqual({ todo: 2, done: 1 });
    expect(res.body.data.byPriority).toEqual({ high: 1, low: 2 });
  });
});

describe('Error handling', () => {
  it('returns a structured 404 for an unknown route', async () => {
    const res = await request(app).get(`${base()}/does-not-exist`).expect(404);

    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `Route not found: GET ${base()}/does-not-exist`,
      },
    });
  });

  it('returns 400 for malformed JSON instead of crashing', async () => {
    const res = await request(app)
      .post(`${base()}/tasks`)
      .set('Content-Type', 'application/json')
      .send('{"title": "broken",,}')
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_JSON');
    // The raw request body must not be reflected back to the client.
    expect(res.body.error.message).not.toMatch(/broken/);
  });

  it('always uses the { success, error } envelope for failures', async () => {
    const res = await request(app).get(`${base()}/tasks/64b7f9c2e13a4b5c6d7e8f90`).expect(404);

    expect(res.body.success).toBe(false);
    expect(typeof res.body.error.message).toBe('string');
    expect(typeof res.body.error.code).toBe('string');
  });
});
