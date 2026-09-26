#!/usr/bin/env bash
set -euo pipefail

BASE="$HOME/jhanvi-dev"
APP="$BASE/notification-service"
PORT=3007
SCHEMA="notification_schema"
DB_ENV="$BASE/user-service/.env"

echo "=========================================="
echo " Jhanvi Cars - Notification Service"
echo " Port   : $PORT"
echo " Schema : $SCHEMA"
echo "=========================================="

if [[ ! -f "$DB_ENV" ]]; then
  echo "ERROR: $DB_ENV not found"
  exit 1
fi

DATABASE_URL="$(grep '^DATABASE_URL=' "$DB_ENV" | head -1 | cut -d= -f2-)"

if [[ -z "$DATABASE_URL" ]]; then
  echo "ERROR: DATABASE_URL not found"
  exit 1
fi

if ss -ltn "sport = :$PORT" | grep -q LISTEN; then
  echo "ERROR: Port $PORT is already in use"
  ss -ltnp "sport = :$PORT" || true
  exit 1
fi

rm -rf "$APP"

mkdir -p "$APP"/{src/{controllers,repositories,routes,services,types,middlewares},migrations}

cat > "$APP/package.json" <<'JSON'
{
  "name": "notification-service",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "migrate": "knex --knexfile knexfile.ts migrate:latest"
  },
  "dependencies": {
    "dotenv": "16.4.5",
    "express": "4.19.2",
    "knex": "3.1.0",
    "pg": "8.12.0",
    "zod": "3.23.8"
  },
  "devDependencies": {
    "@types/express": "5.0.0",
    "@types/node": "22.5.4",
    "ts-node": "10.9.2",
    "ts-node-dev": "2.0.0",
    "typescript": "5.5.3"
  }
}
JSON

cat > "$APP/tsconfig.json" <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts"]
}
JSON

cat > "$APP/.env" <<EOF_ENV
DATABASE_URL=$DATABASE_URL
PORT=$PORT
DB_SCHEMA=$SCHEMA
EOF_ENV

cat > "$APP/knexfile.ts" <<'TS'
import type { Knex } from "knex";
import "dotenv/config";

const schemaName = process.env.DB_SCHEMA ?? "notification_schema";

const config: { [key: string]: Knex.Config } = {
  development: {
    client: "pg",
    connection: process.env.DATABASE_URL,
    searchPath: [schemaName, "public"],
    migrations: {
      directory: "./migrations",
      tableName: "knex_migrations_notification",
      extension: "ts",
      schemaName
    }
  }
};

export default config;
TS

cat > "$APP/src/database.ts" <<'TS'
import knex from "knex";
import "dotenv/config";

const schema = process.env.DB_SCHEMA ?? "notification_schema";

const db = knex({
  client: "pg",
  connection: process.env.DATABASE_URL,
  searchPath: [schema, "public"]
});

export default db;
TS

cat > "$APP/src/types/notification.ts" <<'TS'
export type NotificationChannel =
  | "EMAIL"
  | "SMS"
  | "PUSH";

export type NotificationStatus =
  | "PENDING"
  | "SENT"
  | "FAILED"
  | "READ";

export interface Notification {
  id: string;
  userId: string;
  bookingId?: string | null;
  channel: NotificationChannel;
  title: string;
  message: string;
  status: NotificationStatus;
  recipient: string;
  createdAt?: string;
  updatedAt?: string;
}
TS

cat > "$APP/src/repositories/notificationRepository.ts" <<'TS'
import db from "../database";
import {
  Notification,
  NotificationChannel,
  NotificationStatus
} from "../types/notification";

type NotificationRow = {
  id: string;
  user_id: string;
  booking_id: string | null;
  channel: NotificationChannel;
  title: string;
  message: string;
  status: NotificationStatus;
  recipient: string;
  created_at?: Date | string;
  updated_at?: Date | string;
};

const mapRow = (row: NotificationRow): Notification => ({
  id: row.id,
  userId: row.user_id,
  bookingId: row.booking_id,
  channel: row.channel,
  title: row.title,
  message: row.message,
  status: row.status,
  recipient: row.recipient,
  createdAt: row.created_at?.toString(),
  updatedAt: row.updated_at?.toString()
});

export const notificationRepository = {
  async findAll() {
    const rows = await db<NotificationRow>("notifications")
      .select("*")
      .orderBy("created_at", "desc");

    return rows.map(mapRow);
  },

  async findById(id: string) {
    const row = await db<NotificationRow>("notifications")
      .where({ id })
      .first();

    return row ? mapRow(row) : null;
  },

  async create(notification: Notification) {
    const [row] = await db<NotificationRow>("notifications")
      .insert({
        id: notification.id,
        user_id: notification.userId,
        booking_id: notification.bookingId ?? null,
        channel: notification.channel,
        title: notification.title,
        message: notification.message,
        status: notification.status,
        recipient: notification.recipient
      })
      .returning("*");

    return mapRow(row);
  },

  async update(
    id: string,
    data: Omit<
      Notification,
      "id" | "status" | "createdAt" | "updatedAt"
    >
  ) {
    const [row] = await db<NotificationRow>("notifications")
      .where({ id })
      .update({
        user_id: data.userId,
        booking_id: data.bookingId ?? null,
        channel: data.channel,
        title: data.title,
        message: data.message,
        recipient: data.recipient,
        updated_at: db.fn.now()
      })
      .returning("*");

    return row ? mapRow(row) : null;
  },

  async updateStatus(
    id: string,
    status: NotificationStatus
  ) {
    const [row] = await db<NotificationRow>("notifications")
      .where({ id })
      .update({
        status,
        updated_at: db.fn.now()
      })
      .returning("*");

    return row ? mapRow(row) : null;
  }
};
TS

cat > "$APP/src/services/notificationService.ts" <<'TS'
import {
  notificationRepository
} from "../repositories/notificationRepository";

import {
  Notification,
  NotificationStatus
} from "../types/notification";

export const notificationService = {

  getAll: () =>
    notificationRepository.findAll(),

  getById: async (id: string) => {
    const notification =
      await notificationRepository.findById(id);

    if (!notification) {
      const error = new Error("Notification not found");
      (error as any).statusCode = 404;
      throw error;
    }

    return notification;
  },

  create: (notification: Notification) =>
    notificationRepository.create(notification),

  update: async (
    id: string,
    data: Omit<
      Notification,
      "id" | "status" | "createdAt" | "updatedAt"
    >
  ) => {
    const notification =
      await notificationRepository.update(id, data);

    if (!notification) {
      const error = new Error("Notification not found");
      (error as any).statusCode = 404;
      throw error;
    }

    return notification;
  },

  updateStatus: async (
    id: string,
    status: NotificationStatus
  ) => {
    const notification =
      await notificationRepository.updateStatus(
        id,
        status
      );

    if (!notification) {
      const error = new Error("Notification not found");
      (error as any).statusCode = 404;
      throw error;
    }

    return notification;
  }
};
TS

cat > "$APP/src/middlewares/asyncHandler.ts" <<'TS'
import { RequestHandler } from "express";

export const asyncHandler =
  (handler: RequestHandler): RequestHandler =>
    (req, res, next) =>
      Promise
        .resolve(handler(req, res, next))
        .catch(next);
TS

cat > "$APP/src/middlewares/errorHandler.ts" <<'TS'
import { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler =
  (err, _req, res, _next) => {

    if (err?.code === "23505") {
      return res.status(409).json({
        message: "Duplicate notification data",
        detail:
          err.detail ??
          "Unique notification field already exists."
      });
    }

    const statusCode =
      Number(err?.statusCode) || 500;

    return res.status(statusCode).json({
      message:
        statusCode === 500
          ? "Internal server error"
          : err.message
    });
  };
TS

cat > "$APP/src/controllers/notificationController.ts" <<'TS'
import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";

import {
  notificationService
} from "../services/notificationService";

const channelSchema =
  z.enum(["EMAIL", "SMS", "PUSH"]);

const statusSchema =
  z.enum([
    "PENDING",
    "SENT",
    "FAILED",
    "READ"
  ]);

const createNotificationSchema = z.object({
  userId: z.string().min(1),
  bookingId: z.string().min(1).nullable().optional(),
  channel: channelSchema,
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  status: statusSchema.default("PENDING"),
  recipient: z.string().min(1).max(320)
});

const updateNotificationSchema = z.object({
  userId: z.string().min(1),
  bookingId: z.string().min(1).nullable().optional(),
  channel: channelSchema,
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  recipient: z.string().min(1).max(320)
});

const updateStatusSchema = z.object({
  status: statusSchema
});

export const notificationController = {

  health: async (_req: Request, res: Response) => {
    res.json({
      service: "notification-service",
      status: "UP",
      database: "UP"
    });
  },

  getAll: async (_req: Request, res: Response) => {
    res.json(
      await notificationService.getAll()
    );
  },

  getById: async (
    req: Request,
    res: Response
  ) => {
    res.json(
      await notificationService.getById(
        String(req.params.id)
      )
    );
  },

  create: async (
    req: Request,
    res: Response
  ) => {
    const parsed =
      createNotificationSchema.safeParse(
        req.body
      );

    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten()
      });
    }

    const notification =
      await notificationService.create({
        id: randomUUID(),
        ...parsed.data
      });

    return res.status(201).json(notification);
  },

  update: async (
    req: Request,
    res: Response
  ) => {
    const parsed =
      updateNotificationSchema.safeParse(
        req.body
      );

    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten()
      });
    }

    return res.json(
      await notificationService.update(
        String(req.params.id),
        parsed.data
      )
    );
  },

  updateStatus: async (
    req: Request,
    res: Response
  ) => {
    const parsed =
      updateStatusSchema.safeParse(
        req.body
      );

    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten()
      });
    }

    return res.json(
      await notificationService.updateStatus(
        String(req.params.id),
        parsed.data.status
      )
    );
  }
};
TS

cat > "$APP/src/routes/notificationRoutes.ts" <<'TS'
import { Router } from "express";

import {
  notificationController
} from "../controllers/notificationController";

import {
  asyncHandler
} from "../middlewares/asyncHandler";

const router = Router();

router.get(
  "/health",
  asyncHandler(notificationController.health)
);

router.get(
  "/notifications",
  asyncHandler(notificationController.getAll)
);

router.get(
  "/notifications/:id",
  asyncHandler(notificationController.getById)
);

router.post(
  "/notifications",
  asyncHandler(notificationController.create)
);

router.put(
  "/notifications/:id",
  asyncHandler(notificationController.update)
);

router.patch(
  "/notifications/:id/status",
  asyncHandler(notificationController.updateStatus)
);

export default router;
TS

cat > "$APP/src/server.ts" <<'TS'
import express from "express";
import "dotenv/config";

import notificationRoutes
  from "./routes/notificationRoutes";

import db from "./database";

import {
  errorHandler
} from "./middlewares/errorHandler";

const app = express();

const port =
  Number(process.env.PORT ?? 3007);

app.use(express.json());
app.use(notificationRoutes);
app.use(errorHandler);

async function start() {
  await db.raw("select 1");

  app.listen(port, () => {
    console.log(
      `notification-service listening on port ${port}`
    );
  });
}

start().catch((error) => {
  console.error(
    "Failed to start notification-service",
    error
  );

  process.exit(1);
});
TS

cat > "$APP/migrations/202609260001_create_notifications.ts" <<'TS'
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {

  await knex.schema.createTable(
    "notifications",
    (table) => {

      table
        .string("id", 100)
        .primary();

      table
        .string("user_id", 100)
        .notNullable();

      table
        .string("booking_id", 100)
        .nullable();

      table
        .string("channel", 30)
        .notNullable();

      table
        .string("title", 200)
        .notNullable();

      table
        .text("message")
        .notNullable();

      table
        .string("status", 30)
        .notNullable()
        .defaultTo("PENDING");

      table
        .string("recipient", 320)
        .notNullable();

      table
        .timestamp("created_at")
        .notNullable()
        .defaultTo(knex.fn.now());

      table
        .timestamp("updated_at")
        .notNullable()
        .defaultTo(knex.fn.now());

      table.index(["user_id"]);
      table.index(["booking_id"]);
      table.index(["status"]);
      table.index(["channel"]);
    }
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .dropTableIfExists("notifications");
}
TS

cd "$APP"

echo
echo "Installing dependencies..."
npm install

echo
echo "Creating PostgreSQL schema..."
sudo -u postgres psql \
  -d jhanvi_cars \
  -v ON_ERROR_STOP=1 <<SQL

CREATE SCHEMA IF NOT EXISTS $SCHEMA;

ALTER SCHEMA $SCHEMA OWNER TO user_user;

GRANT USAGE, CREATE
ON SCHEMA $SCHEMA
TO user_user;

GRANT ALL PRIVILEGES
ON ALL TABLES IN SCHEMA $SCHEMA
TO user_user;

GRANT ALL PRIVILEGES
ON ALL SEQUENCES IN SCHEMA $SCHEMA
TO user_user;

ALTER DEFAULT PRIVILEGES
IN SCHEMA $SCHEMA
GRANT ALL ON TABLES
TO user_user;

ALTER DEFAULT PRIVILEGES
IN SCHEMA $SCHEMA
GRANT ALL ON SEQUENCES
TO user_user;

SQL

echo
echo "Running migration..."
npm run migrate

echo
echo "Building..."
npm run build

echo
echo "Creating systemd service..."

sudo tee /etc/systemd/system/notification-service.service >/dev/null <<EOF_SYSTEMD
[Unit]
Description=Jhanvi Cars Notification Service
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=srini
WorkingDirectory=$APP
EnvironmentFile=$APP/.env
ExecStart=/usr/bin/node $APP/dist/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF_SYSTEMD

sudo systemctl daemon-reload
sudo systemctl enable notification-service
sudo systemctl restart notification-service

sleep 3

echo
echo "Running smoke test..."

sudo systemctl stop notification-service 2>/dev/null || true

TEST_RESPONSE="$(
  curl -sS -X POST \
    http://localhost:$PORT/notifications \
    -H "Content-Type: application/json" \
    -d '{
      "userId":"user-001",
      "bookingId":"booking-001",
      "channel":"PUSH",
      "title":"Smoke Test",
      "message":"Notification service smoke test",
      "recipient":"user-001"
    }' \
    || true
)"

echo "Smoke notification response:"
echo "$TEST_RESPONSE"

TEST_ID="$(
  printf '%s' "$TEST_RESPONSE" |
  sed -n 's/.*"id":"\([^"]*\)".*/\1/p'
)"

if [[ -z "$TEST_ID" ]]; then
  echo "ERROR: Smoke test notification was not created."
  exit 1
fi

echo
echo "Created smoke-test notification:"
echo "$TEST_ID"

echo
echo "Testing GET..."
curl -fsS \
  "http://localhost:$PORT/notifications/$TEST_ID"

echo

echo
echo "Testing status update..."

curl -fsS -X PATCH \
  "http://localhost:$PORT/notifications/$TEST_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"SENT"}'

echo

echo
echo "Testing invalid status..."

INVALID_RESPONSE="$(
  curl -sS \
    -o /tmp/notification-invalid-response.json \
    -w "%{http_code}" \
    -X PATCH \
    "http://localhost:$PORT/notifications/$TEST_ID/status" \
    -H "Content-Type: application/json" \
    -d '{"status":"INVALID"}'
)"

echo "HTTP status: $INVALID_RESPONSE"

if [[ "$INVALID_RESPONSE" != "400" ]]; then
  echo "ERROR: Expected HTTP 400 for invalid status."
  cat /tmp/notification-invalid-response.json
  exit 1
fi

echo
echo "Testing update..."

curl -fsS -X PUT \
  "http://localhost:$PORT/notifications/$TEST_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"user-001",
    "bookingId":"booking-001",
    "channel":"EMAIL",
    "title":"Smoke Test Updated",
    "message":"Updated notification smoke test",
    "recipient":"test@example.com"
  }'

echo

echo
echo "Testing list..."

curl -fsS \
  "http://localhost:$PORT/notifications"

echo

echo
echo "Cleaning smoke-test notification..."

sudo -u postgres psql \
  -d jhanvi_cars \
  -v ON_ERROR_STOP=1 \
  -c "DELETE FROM ${SCHEMA}.notifications WHERE id = '$TEST_ID';"

echo
echo "Smoke test completed successfully."

echo
echo "Creating systemd service..."

sudo tee /etc/systemd/system/notification-service.service >/dev/null <<EOF_SYSTEMD
[Unit]
Description=Jhanvi Cars Notification Service
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=srini
WorkingDirectory=$APP
EnvironmentFile=$APP/.env
ExecStart=/usr/bin/node $APP/dist/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF_SYSTEMD

sudo systemctl daemon-reload
sudo systemctl enable notification-service
sudo systemctl restart notification-service

sleep 3

echo
echo "=========================================="
echo " Notification Service Status"
echo "=========================================="

sudo systemctl --no-pager --full status notification-service

echo
echo "=========================================="
echo " Health Check"
echo "=========================================="

curl -fsS \
  http://localhost:$PORT/health

echo
echo
echo "=========================================="
echo " Notification Service Ready"
echo "=========================================="

echo
echo "Endpoints:"
echo "  GET    http://localhost:$PORT/health"
echo "  GET    http://localhost:$PORT/notifications"
echo "  GET    http://localhost:$PORT/notifications/:id"
echo "  POST   http://localhost:$PORT/notifications"
echo "  PUT    http://localhost:$PORT/notifications/:id"
echo "  PATCH  http://localhost:$PORT/notifications/:id/status"

echo
echo "Logs:"
echo "  sudo journalctl -u notification-service -f"

echo
echo "Schema:"
echo "  $SCHEMA"

