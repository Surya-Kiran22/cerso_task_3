# Task Management API

A RESTful task-management backend built with **Node.js**, **Express**, **TypeScript** and **MongoDB (Mongoose)**, featuring full CRUD, layered input validation and centralised error handling.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [API reference](#api-reference)
- [Data model](#data-model)
- [Response format](#response-format)
- [Error handling](#error-handling)
- [Testing](#testing)
- [Available scripts](#available-scripts)

---

## Features

| Requirement | How it is met |
| --- | --- |
| REST API | Versioned RESTful routes under `/api/v1`, plus a health probe |
| Database connection | Mongoose connection pool opened before the server accepts traffic, with lifecycle listeners and a clean shutdown path |
| Create, Read, Update, Delete | `POST`, `GET` (list + single), `PATCH`/`PUT`, `DELETE`, plus a stats aggregation |
| Input validation | Zod schemas for body, params and query; unknown fields are rejected; values are trimmed/coerced before reaching the controller |
| Error handling | Single error-handling middleware that maps Mongoose, Zod, body-parser and duplicate-key errors onto consistent HTTP responses, and never leaks internals in production |
| Tests | 42 Jest + Supertest integration tests against a real MongoDB test database, plus an importable Postman collection |
| Organised code | Layered architecture: routes → controllers → services → models |

Additional touches: pagination, filtering, sorting, regex-safe search, `completedAt` bookkeeping, graceful shutdown, security headers (`helmet`), CORS, request logging and JSON body size limits.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Runtime | Node.js 20+ |
| Language | TypeScript 5 (strict mode) |
| Framework | Express 4 |
| Database | MongoDB 8 via Mongoose 8 |
| Validation | Zod 3 |
| Security | helmet, cors |
| Logging | morgan + small internal logger |
| Testing | Jest, ts-jest, Supertest |
| Dev runner | tsx (watch mode) |

---

## Project structure

```
.
├── src/
│   ├── config/
│   │   ├── database.ts        # Mongoose connection lifecycle
│   │   └── env.ts             # Zod-validated environment variables
│   ├── constants/
│   │   └── task.ts            # Enums, sort options, pagination limits
│   ├── controllers/
│   │   ├── health.controller.ts
│   │   └── task.controller.ts # HTTP layer: read req, call service, send res
│   ├── middlewares/
│   │   ├── errorHandler.ts    # Single error handler (registered last)
│   │   ├── notFoundHandler.ts # 404 for unmatched routes
│   │   ├── requestLogger.ts   # HTTP request logging
│   │   └── validate.ts        # Generic Zod validation middleware
│   ├── models/
│   │   └── task.model.ts      # Mongoose schema, indexes, serialisation
│   ├── routes/
│   │   ├── index.ts           # API index + health
│   │   └── task.routes.ts     # Task routes and validation wiring
│   ├── services/
│   │   └── task.service.ts    # Business logic and DB queries
│   ├── types/
│   │   └── task.ts            # Shared TypeScript types
│   ├── utils/
│   │   ├── ApiError.ts        # Operational error class
│   │   ├── apiResponse.ts     # Success/error response helpers
│   │   ├── asyncHandler.ts    # Async route wrapper
│   │   └── logger.ts
│   ├── validators/
│   │   └── task.validator.ts  # Zod schemas
│   ├── app.ts                 # Express app assembly
│   └── server.ts              # Startup, graceful shutdown
├── tests/
│   ├── env.setup.ts           # Points the app at the test database
│   ├── setup.ts               # DB connection + per-test cleanup
│   └── task.test.ts           # Integration tests
├── postman/
│   └── Task-Management-API.postman_collection.json
├── .env.example
├── jest.config.js
├── tsconfig.json
├── tsconfig.build.json
└── package.json
```

The layering keeps each file focused: **routes** declare URLs and attach validators, **controllers** handle the HTTP conversation, **services** own the business rules and queries, and **models** describe the data.

---

## Getting started

### Prerequisites

- Node.js 20 or newer
- A running MongoDB instance (local install, Docker, or a free MongoDB Atlas cluster)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the environment

```bash
# Windows PowerShell
Copy-Item .env.example .env

# macOS / Linux
cp .env.example .env
```

Edit `.env` if your MongoDB is not on the default local address.

### 3. Run the server

```bash
npm run dev      # watch mode (tsx)
```

The API is then available at `http://localhost:4000/api/v1`.

Verify it is up:

```bash
curl http://localhost:4000/health
```

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "database": "connected",
    "uptime": 3.214,
    "timestamp": "2026-01-15T10:30:00.000Z"
  }
}
```

The server will **refuse to start** if it cannot reach MongoDB, so you never get a half-working service.

---

## Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | `development`, `test` or `production` |
| `PORT` | No | `4000` | Port the HTTP server listens on |
| `API_PREFIX` | No | `/api/v1` | Prefix for all versioned routes |
| `MONGODB_URI` | **Yes** | — | MongoDB connection string |
| `MONGODB_DB_NAME` | No | `task_management` | Database name |
| `CORS_ORIGIN` | No | `*` | `*` or a comma-separated origin whitelist |
| `LOG_FORMAT` | No | `dev` | `dev`, `tiny` or `combined` |

Invalid configuration is reported at startup with a precise list of problems:

```
Invalid environment configuration:
  - MONGODB_URI: MONGODB_URI is required
```

---

## API reference

Base URL: `http://localhost:4000/api/v1`

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Health check (also available at the root `/health`) |
| `GET` | `/api/v1` | Endpoint index |
| `POST` | `/tasks` | **Create** a task |
| `GET` | `/tasks` | **Read** tasks — filter, search, sort, paginate |
| `GET` | `/tasks/:id` | **Read** a single task |
| `PATCH` | `/tasks/:id` | **Update** selected fields |
| `PUT` | `/tasks/:id` | **Update** (same rules as PATCH) |
| `DELETE` | `/tasks/:id` | **Delete** a task |
| `GET` | `/tasks/stats` | Counts grouped by status and priority |

### Query parameters for `GET /tasks`

| Parameter | Type | Default | Notes |
| --- | --- | --- | --- |
| `status` | `todo` \| `in_progress` \| `done` | — | Filter |
| `priority` | `low` \| `medium` \| `high` | — | Filter |
| `search` | string | — | Case-insensitive match on title, description and tags. Regex metacharacters are escaped |
| `page` | integer ≥ 1 | `1` | Page number |
| `limit` | integer 1–100 | `10` | Page size |
| `sortBy` | `createdAt`, `updatedAt`, `dueDate`, `priority`, `status`, `title` | `createdAt` | Sort field |
| `sortOrder` | `asc` \| `desc` | `desc` | Sort direction |

Unknown query parameters are rejected with `422`.

### Examples

**Create**

```bash
curl -X POST http://localhost:4000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
        "title": "Ship the release",
        "description": "Tag, build, publish and announce.",
        "status": "in_progress",
        "priority": "high",
        "dueDate": "2030-12-31T17:00:00.000Z",
        "tags": ["release", "ops"]
      }'
```

```json
{
  "success": true,
  "data": {
    "_id": "6ab77c21658013ebdd53a123",
    "title": "Ship the release",
    "description": "Tag, build, publish and announce.",
    "status": "in_progress",
    "priority": "high",
    "dueDate": "2030-12-31T17:00:00.000Z",
    "tags": ["release", "ops"],
    "completedAt": null,
    "isOverdue": false,
    "createdAt": "2026-01-15T10:30:00.000Z",
    "updatedAt": "2026-01-15T10:30:00.000Z"
  },
  "meta": { "message": "Task created successfully" }
}
```

**List with filters**

```bash
curl "http://localhost:4000/api/v1/tasks?status=in_progress&priority=high&limit=5&sortBy=dueDate&sortOrder=asc"
```

**Update** — send only the fields you want to change. Use `"dueDate": null` to clear a deadline.

```bash
curl -X PATCH http://localhost:4000/api/v1/tasks/6ab77c21658013ebdd53a123 \
  -H "Content-Type: application/json" \
  -d '{ "status": "done" }'
```

Setting `status` to `done` stamps `completedAt`; changing it back to `todo` or `in_progress` clears it.

**Delete**

```bash
curl -X DELETE http://localhost:4000/api/v1/tasks/6ab77c21658013ebdd53a123
```

---

## Data model

```ts
{
  title:       string;          // required, 3–120 chars, trimmed
  description?: string;          // max 1000 chars
  status:      'todo' | 'in_progress' | 'done';   // default 'todo'
  priority:    'low' | 'medium' | 'high';         // default 'medium'
  dueDate?:    Date | null;      // ISO-8601
  tags:        string[];         // max 10, lower-cased and de-duplicated
  completedAt: Date | null;      // managed automatically
  createdAt:   Date;             // managed by Mongoose timestamps
  updatedAt:   Date;             // managed by Mongoose timestamps
}
```

`isOverdue` is computed on read: a past `dueDate` on a task that is not `done`.

Indexes: `{ status: 1, createdAt: -1 }` for the default listing, plus single-field indexes on `title` and `tags` to support search.

---

## Response format

Every response uses the same envelope, so clients can rely on one shape.

**Success**

```json
{ "success": true, "data": { }, "meta": { } }
```

**Error**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [ { "field": "title", "message": "Title must be at least 3 characters" } ]
  }
}
```

List endpoints add pagination metadata:

```json
"meta": {
  "pagination": {
    "total": 42, "page": 1, "limit": 10,
    "totalPages": 5, "hasNextPage": true, "hasPrevPage": false
  }
}
```

---

## Error handling

| Status | Code | When |
| --- | --- | --- |
| `400` | `INVALID_JSON` | Request body is not valid JSON |
| `400` | `PAYLOAD_TOO_LARGE` | Body exceeds the 100 kB limit |
| `404` | `TASK_NOT_FOUND` | No task with that id |
| `404` | `ROUTE_NOT_FOUND` | No route matches the request |
| `409` | `DUPLICATE_KEY` | Would violate a unique index |
| `422` | `VALIDATION_ERROR` | Input failed Zod or Mongoose validation |
| `422` | `INVALID_IDENTIFIER` | Malformed ObjectId |
| `500` | `INTERNAL_ERROR` | Unexpected failure (details logged, never returned) |

Design points:

- `ApiError` marks *operational* errors that are safe to show a client; anything else is logged with a full stack trace and reported as a generic `500`.
- Mongoose `ValidationError` → `422` with per-field messages; `CastError` → `422`; duplicate key (`E11000`) → `409`.
- In `NODE_ENV=production`, `5xx` responses are reduced to a generic message.
- Errors raised before your routes run (bad JSON, oversized payload) are caught and reported with their intended `4xx` status rather than becoming `500`s.
- `SIGINT`/`SIGTERM` trigger a graceful shutdown that stops accepting connections and closes the database, with a 10-second safety timeout.

---

## Testing

### Automated integration tests

42 tests run against a **real MongoDB test database** (`task_management_test`), so the connection layer is genuinely exercised. Each test starts from a clean collection, and the test database is dropped when the run finishes.

```bash
npm test              # run once
npm run test:watch    # watch mode
npm run test:coverage # with coverage report
```

Coverage highlights: controllers, services, models and routes are all at or near 100%.

The suite covers:

- Health check and API index
- Create: defaults, all optional fields, tag normalisation, `completedAt` on `status: done`, `isOverdue`
- Validation: missing/short title, bad enum, malformed date, unknown fields, too many tags
- List: pagination metadata, filter by status and priority, search, regex-safe search, sorting, invalid sort field, unknown query parameter
- Read single: success, `404` for unknown id, `422` for malformed id
- Update: partial update, `completedAt` transitions both ways, clearing `dueDate`, empty payload, `404`
- Delete: success, task gone afterwards, `404` on second delete, `422` on malformed id
- Stats aggregation
- Error handling: unknown route, malformed JSON, consistent error envelope

### Postman

Import `postman/Task-Management-API.postman_collection.json` in Postman (or `npx newman run` for CI).

18 pre-configured requests are grouped into **Health**, **Create**, **Read**, **Update**, **Delete** and **Error Cases**. The first request saves the new task id into the `taskId` collection variable, so run the requests in order and the rest resolve automatically. Several requests include Postman test scripts that assert the status code and payload.

To run without the Postman app:

```bash
npx newman run postman/Task-Management-API.postman_collection.json
```

(Requires the server to be running via `npm run dev`.)

---

## Available scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the server in watch mode |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |
| `npm run typecheck` | Type-check without emitting |
| `npm test` | Run the test suite |
| `npm run test:watch` | Tests in watch mode |
| `npm run test:coverage` | Tests with coverage |
