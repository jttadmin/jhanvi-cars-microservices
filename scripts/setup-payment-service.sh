#!/usr/bin/env bash
set -euo pipefail

BASE="$HOME/jhanvi-dev"
APP="$BASE/payment-service"
PORT=3006
SCHEMA="payment_schema"
DB_ENV="$BASE/user-service/.env"

echo "=========================================="
echo " Jhanvi Cars - Payment Service"
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
  "name": "payment-service",
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

const schemaName = process.env.DB_SCHEMA ?? "payment_schema";

const config: { [key: string]: Knex.Config } = {
  development: {
    client: "pg",
    connection: process.env.DATABASE_URL,
    searchPath: [schemaName, "public"],
    migrations: {
      directory: "./migrations",
      tableName: "knex_migrations_payment",
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

const schema = process.env.DB_SCHEMA ?? "payment_schema";

export default knex({
  client: "pg",
  connection: process.env.DATABASE_URL,
  searchPath: [schema, "public"]
});
TS

cat > "$APP/src/types/payment.ts" <<'TS'
export type PaymentMethod = "CASH" | "CARD" | "UPI" | "WALLET";

export type PaymentStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "PAID"
  | "FAILED"
  | "REFUNDED";

export interface Payment {
  id: string;
  bookingId: string;
  userId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
TS

cat > "$APP/src/repositories/paymentRepository.ts" <<'TS'
import db from "../database";
import { Payment, PaymentMethod, PaymentStatus } from "../types/payment";

type PaymentRow = {
  id: string;
  booking_id: string;
  user_id: string;
  amount: string | number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transaction_id: string | null;
  created_at?: Date | string;
  updated_at?: Date | string;
};

const mapRow = (row: PaymentRow): Payment => ({
  id: row.id,
  bookingId: row.booking_id,
  userId: row.user_id,
  amount: Number(row.amount),
  currency: row.currency,
  method: row.method,
  status: row.status,
  transactionId: row.transaction_id,
  createdAt: row.created_at?.toString(),
  updatedAt: row.updated_at?.toString()
});

export const paymentRepository = {
  async findAll() {
    const rows = await db<PaymentRow>("payments")
      .select("*")
      .orderBy("created_at", "desc");

    return rows.map(mapRow);
  },

  async findById(id: string) {
    const row = await db<PaymentRow>("payments")
      .where({ id })
      .first();

    return row ? mapRow(row) : null;
  },

  async create(payment: Payment) {
    const [row] = await db<PaymentRow>("payments")
      .insert({
        id: payment.id,
        booking_id: payment.bookingId,
        user_id: payment.userId,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        transaction_id: payment.transactionId ?? null
      })
      .returning("*");

    return mapRow(row);
  },

  async update(id: string, data: Omit<Payment, "id" | "status" | "createdAt" | "updatedAt">) {
    const [row] = await db<PaymentRow>("payments")
      .where({ id })
      .update({
        booking_id: data.bookingId,
        user_id: data.userId,
        amount: data.amount,
        currency: data.currency,
        method: data.method,
        transaction_id: data.transactionId ?? null,
        updated_at: db.fn.now()
      })
      .returning("*");

    return row ? mapRow(row) : null;
  },

  async updateStatus(id: string, status: PaymentStatus) {
    const [row] = await db<PaymentRow>("payments")
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

cat > "$APP/src/services/paymentService.ts" <<'TS'
import { paymentRepository } from "../repositories/paymentRepository";
import { Payment, PaymentStatus } from "../types/payment";

export const paymentService = {
  getAll: () => paymentRepository.findAll(),

  getById: async (id: string) => {
    const payment = await paymentRepository.findById(id);

    if (!payment) {
      const error = new Error("Payment not found");
      (error as any).statusCode = 404;
      throw error;
    }

    return payment;
  },

  create: (payment: Payment) =>
    paymentRepository.create(payment),

  update: async (
    id: string,
    data: Omit<Payment, "id" | "status" | "createdAt" | "updatedAt">
  ) => {
    const payment = await paymentRepository.update(id, data);

    if (!payment) {
      const error = new Error("Payment not found");
      (error as any).statusCode = 404;
      throw error;
    }

    return payment;
  },

  updateStatus: async (id: string, status: PaymentStatus) => {
    const payment = await paymentRepository.updateStatus(id, status);

    if (!payment) {
      const error = new Error("Payment not found");
      (error as any).statusCode = 404;
      throw error;
    }

    return payment;
  }
};
TS

cat > "$APP/src/middlewares/asyncHandler.ts" <<'TS'
import { RequestHandler } from "express";

export const asyncHandler = (handler: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);
TS

cat > "$APP/src/middlewares/errorHandler.ts" <<'TS'
import { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler =
  (err, _req, res, _next) => {

    if (err?.code === "23505") {
      return res.status(409).json({
        message: "Duplicate payment data",
        detail: err.detail ?? "Unique payment field already exists."
      });
    }

    const statusCode = Number(err?.statusCode) || 500;

    return res.status(statusCode).json({
      message:
        statusCode === 500
          ? "Internal server error"
          : err.message
    });
  };
TS

cat > "$APP/src/controllers/paymentController.ts" <<'TS'
import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { paymentService } from "../services/paymentService";

const paymentMethodSchema =
  z.enum(["CASH", "CARD", "UPI", "WALLET"]);

const paymentStatusSchema =
  z.enum([
    "PENDING",
    "AUTHORIZED",
    "PAID",
    "FAILED",
    "REFUNDED"
  ]);

const createPaymentSchema = z.object({
  bookingId: z.string().min(1),
  userId: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/).default("INR"),
  method: paymentMethodSchema,
  status: paymentStatusSchema.default("PENDING"),
  transactionId: z.string().min(1).nullable().optional()
});

const updatePaymentSchema = z.object({
  bookingId: z.string().min(1),
  userId: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  method: paymentMethodSchema,
  transactionId: z.string().min(1).nullable().optional()
});

const updateStatusSchema = z.object({
  status: paymentStatusSchema
});

export const paymentController = {

  health: async (_req: Request, res: Response) => {
    res.json({
      service: "payment-service",
      status: "UP",
      database: "UP"
    });
  },

  getAll: async (_req: Request, res: Response) => {
    res.json(await paymentService.getAll());
  },

  getById: async (req: Request, res: Response) => {
    res.json(await paymentService.getById(req.params.id));
  },

  create: async (req: Request, res: Response) => {
    const parsed = createPaymentSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten()
      });
    }

    const payment = await paymentService.create({
      id: randomUUID(),
      ...parsed.data
    });

    return res.status(201).json(payment);
  },

  update: async (req: Request, res: Response) => {
    const parsed = updatePaymentSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten()
      });
    }

    return res.json(
      await paymentService.update(req.params.id, parsed.data)
    );
  },

  updateStatus: async (req: Request, res: Response) => {
    const parsed = updateStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten()
      });
    }

    return res.json(
      await paymentService.updateStatus(
        req.params.id,
        parsed.data.status
      )
    );
  }
};
TS

cat > "$APP/src/routes/paymentRoutes.ts" <<'TS'
import { Router } from "express";
import { paymentController } from "../controllers/paymentController";
import { asyncHandler } from "../middlewares/asyncHandler";

const router = Router();

router.get("/health", asyncHandler(paymentController.health));
router.get("/payments", asyncHandler(paymentController.getAll));
router.get("/payments/:id", asyncHandler(paymentController.getById));
router.post("/payments", asyncHandler(paymentController.create));
router.put("/payments/:id", asyncHandler(paymentController.update));
router.patch("/payments/:id/status", asyncHandler(paymentController.updateStatus));

export default router;
TS

cat > "$APP/src/server.ts" <<'TS'
import express from "express";
import "dotenv/config";
import paymentRoutes from "./routes/paymentRoutes";
import db from "./database";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();
const port = Number(process.env.PORT ?? 3006);

app.use(express.json());
app.use(paymentRoutes);
app.use(errorHandler);

async function start() {
  await db.raw("select 1");

  app.listen(port, () => {
    console.log(`payment-service listening on port ${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start payment-service", error);
  process.exit(1);
});
TS

cat > "$APP/migrations/202609250001_create_payments.ts" <<'TS'
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("payments", (table) => {

    table.string("id", 100).primary();

    table.string("booking_id", 100).notNullable();
    table.string("user_id", 100).notNullable();

    table.decimal("amount", 12, 2).notNullable();

    table
      .string("currency", 3)
      .notNullable()
      .defaultTo("INR");

    table.string("method", 30).notNullable();

    table
      .string("status", 30)
      .notNullable()
      .defaultTo("PENDING");

    table
      .string("transaction_id", 150)
      .nullable()
      .unique();

    table
      .timestamp("created_at")
      .notNullable()
      .defaultTo(knex.fn.now());

    table
      .timestamp("updated_at")
      .notNullable()
      .defaultTo(knex.fn.now());

    table.index(["booking_id"]);
    table.index(["user_id"]);
    table.index(["status"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("payments");
}
TS

cd "$APP"

echo "Installing dependencies..."
npm install

echo "Creating PostgreSQL schema..."
sudo -u postgres psql -d jhanvi_cars -v ON_ERROR_STOP=1 <<SQL
CREATE SCHEMA IF NOT EXISTS $SCHEMA;

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
GRANT ALL ON TABLES TO user_user;

ALTER DEFAULT PRIVILEGES
IN SCHEMA $SCHEMA
GRANT ALL ON SEQUENCES TO user_user;
SQL

echo "Running migration..."
npm run migrate

echo "Building..."
npm run build

echo "Creating systemd service..."

sudo tee /etc/systemd/system/payment-service.service >/dev/null <<EOF_SYSTEMD
[Unit]
Description=Jhanvi Cars Payment Service
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
sudo systemctl enable payment-service
sudo systemctl restart payment-service

sleep 3

echo
echo "=========================================="
echo " Payment Service Status"
echo "=========================================="

sudo systemctl --no-pager --full status payment-service

echo
echo "=========================================="
echo " Health Check"
echo "=========================================="

curl -fsS http://localhost:3006/health

echo
echo
echo "=========================================="
echo " Payment Service Ready"
echo "=========================================="
echo
echo "Endpoints:"
echo "  GET    http://localhost:3006/health"
echo "  GET    http://localhost:3006/payments"
echo "  GET    http://localhost:3006/payments/:id"
echo "  POST   http://localhost:3006/payments"
echo "  PUT    http://localhost:3006/payments/:id"
echo "  PATCH  http://localhost:3006/payments/:id/status"
echo
echo "Logs:"
echo "  sudo journalctl -u payment-service -f"
