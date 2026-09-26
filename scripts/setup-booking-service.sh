#!/usr/bin/env bash

set -euo pipefail

SERVICE_NAME="booking-service"
SERVICE_DIR="$HOME/jhanvi-dev/booking-service"
PORT="3004"
DB_SCHEMA="booking_schema"
DB_NAME="jhanvi_cars"
DB_USER="user_user"

echo "=========================================="
echo " Jhanvi Cars - Booking Service Setup"
echo "=========================================="

echo
echo "==> Checking User Service environment..."

if [ ! -f "$HOME/jhanvi-dev/user-service/.env" ]; then
  echo "ERROR: user-service/.env not found"
  exit 1
fi

DATABASE_URL=$(grep '^DATABASE_URL=' \
  "$HOME/jhanvi-dev/user-service/.env" | head -n 1 | cut -d= -f2-)

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not found"
  exit 1
fi

echo "Database configuration found."

echo
echo "==> Stopping existing Booking Service if present..."

sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || true

echo
echo "==> Checking port $PORT..."

if sudo lsof -i :"$PORT" >/dev/null 2>&1; then
  echo "ERROR: Port $PORT is already in use."
  sudo lsof -i :"$PORT"
  echo
  echo "Stop the process using port $PORT and run this script again."
  exit 1
fi

echo
echo "==> Creating project..."

mkdir -p "$SERVICE_DIR"

cd "$SERVICE_DIR"

mkdir -p \
  src/controllers \
  src/middleware \
  src/repositories \
  src/routes \
  src/services \
  src/types \
  migrations

echo
echo "==> Creating package.json..."

cat > package.json <<'EOF'
{
  "name": "booking-service",
  "version": "1.0.0",
  "description": "Jhanvi Cars Booking Service",
  "main": "dist/server.js",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "migrate": "knex --knexfile knexfile.ts migrate:latest",
    "rollback": "knex --knexfile knexfile.ts migrate:rollback"
  }
}
EOF

echo
echo "==> Installing dependencies..."

npm install \
  express@4.19.2 \
  dotenv@16.4.5 \
  knex@3.1.0 \
  pg@8.12.0 \
  zod@3.23.8

npm install -D \
  typescript@5.5.3 \
  ts-node@10.9.2 \
  ts-node-dev@2.0.0 \
  @types/node@22.10.2 \
  @types/express@4.17.21 \
  @types/pg@8.11.10

echo
echo "==> Creating TypeScript configuration..."

cat > tsconfig.json <<'EOF'
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
  "include": [
    "src/**/*.ts"
  ]
}
EOF

echo
echo "==> Creating environment..."

cat > .env <<EOF
DATABASE_URL=$DATABASE_URL
DB_SCHEMA=$DB_SCHEMA
PORT=$PORT
EOF

echo
echo "==> Creating Knex configuration..."

cat > knexfile.ts <<'EOF'
import type { Knex } from "knex";

import "dotenv/config";

const config: {
  [key: string]: Knex.Config
} = {
  development: {
    client: "pg",

    connection:
      process.env.DATABASE_URL,

    searchPath: [
      process.env.DB_SCHEMA ??
        "booking_schema",
      "public"
    ],

    migrations: {
      directory:
        "./migrations",

      tableName:
        "knex_migrations_booking",

      extension:
        "ts",

      schemaName:
        process.env.DB_SCHEMA ??
        "booking_schema"
    }
  }
};

export default config;
EOF

echo
echo "==> Creating database connection..."

cat > src/database.ts <<'EOF'
import knex from "knex";

import "dotenv/config";

const db = knex({
  client: "pg",

  connection:
    process.env.DATABASE_URL,

  searchPath: [
    process.env.DB_SCHEMA ??
      "booking_schema",
    "public"
  ]
});

export default db;
EOF

echo
echo "==> Creating Booking type..."

cat > src/types/booking.ts <<'EOF'
export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "ONGOING"
  | "COMPLETED"
  | "CANCELLED";

export interface Booking {
  id: string;
  userId: string;
  driverId?: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  scheduledAt: string;
  status: BookingStatus;
  fare: number;
}
EOF

echo
echo "==> Creating Zod schemas..."

cat > src/types/bookingSchema.ts <<'EOF'
import { z } from "zod";

export const bookingStatusSchema =
  z.enum([
    "PENDING",
    "CONFIRMED",
    "ONGOING",
    "COMPLETED",
    "CANCELLED"
  ]);

export const createBookingSchema =
  z.object({
    userId:
      z.string().min(1),

    driverId:
      z.string().min(1).nullable().optional(),

    pickupLocation:
      z.string().min(2),

    dropoffLocation:
      z.string().min(2),

    scheduledAt:
      z.string().datetime({
        offset: true
      }),

    status:
      bookingStatusSchema
        .optional()
        .default("PENDING"),

    fare:
      z.number().nonnegative()
  });

export const updateBookingSchema =
  z.object({
    userId:
      z.string().min(1),

    driverId:
      z.string().min(1).nullable().optional(),

    pickupLocation:
      z.string().min(2),

    dropoffLocation:
      z.string().min(2),

    scheduledAt:
      z.string().datetime({
        offset: true
      }),

    fare:
      z.number().nonnegative()
  });

export const updateBookingStatusSchema =
  z.object({
    status:
      bookingStatusSchema
  });
EOF

echo
echo "==> Creating database migration..."

cat > migrations/001_create_bookings.ts <<'EOF'
import { Knex } from "knex";

export async function up(
  knex: Knex
): Promise<void> {

  await knex.schema
    .withSchema("booking_schema")
    .createTable(
      "bookings",
      (table) => {

        table
          .string("id")
          .primary();

        table
          .string("user_id")
          .notNullable();

        table
          .string("driver_id")
          .nullable();

        table
          .string("pickup_location")
          .notNullable();

        table
          .string("dropoff_location")
          .notNullable();

        table
          .timestamp(
            "scheduled_at",
            { useTz: true }
          )
          .notNullable();

        table
          .string("status")
          .notNullable()
          .defaultTo("PENDING");

        table
          .decimal("fare", 12, 2)
          .notNullable()
          .defaultTo(0);

        table
          .timestamp(
            "created_at",
            { useTz: true }
          )
          .notNullable()
          .defaultTo(knex.fn.now());

        table
          .timestamp(
            "updated_at",
            { useTz: true }
          )
          .notNullable()
          .defaultTo(knex.fn.now());

        table.index([
          "user_id"
        ]);

        table.index([
          "driver_id"
        ]);

        table.index([
          "status"
        ]);

        table.index([
          "scheduled_at"
        ]);
      }
    );
}

export async function down(
  knex: Knex
): Promise<void> {

  await knex.schema
    .withSchema("booking_schema")
    .dropTableIfExists(
      "bookings"
    );
}
EOF

echo
echo "==> Creating Booking repository..."

cat > src/repositories/bookingRepository.ts <<'EOF'
import { Knex } from "knex";

import {
  Booking,
  BookingStatus
} from "../types/booking";

export class BookingRepository {

  constructor(
    private db: Knex
  ) {}

  private mapBooking(
    row: any
  ): Booking {

    return {
      id: row.id,

      userId:
        row.user_id,

      driverId:
        row.driver_id,

      pickupLocation:
        row.pickup_location,

      dropoffLocation:
        row.dropoff_location,

      scheduledAt:
        new Date(
          row.scheduled_at
        ).toISOString(),

      status:
        row.status as BookingStatus,

      fare:
        Number(row.fare)
    };
  }

  async findAll():
    Promise<Booking[]> {

    const rows =
      await this.db("bookings")
        .select("*")
        .orderBy(
          "created_at",
          "desc"
        );

    return rows.map(
      (row) =>
        this.mapBooking(row)
    );
  }

  async findById(
    id: string
  ): Promise<
    Booking | undefined
  > {

    const row =
      await this.db("bookings")
        .where({ id })
        .first();

    if (!row) {
      return undefined;
    }

    return this.mapBooking(row);
  }

  async create(
    booking: Booking
  ): Promise<Booking> {

    const [row] =
      await this.db("bookings")
        .insert({
          id: booking.id,

          user_id:
            booking.userId,

          driver_id:
            booking.driverId ??
            null,

          pickup_location:
            booking.pickupLocation,

          dropoff_location:
            booking.dropoffLocation,

          scheduled_at:
            booking.scheduledAt,

          status:
            booking.status,

          fare:
            booking.fare
        })
        .returning("*");

    return this.mapBooking(row);
  }

  async update(
    id: string,
    booking: Booking
  ): Promise<
    Booking | undefined
  > {

    const [row] =
      await this.db("bookings")
        .where({ id })
        .update({

          user_id:
            booking.userId,

          driver_id:
            booking.driverId ??
            null,

          pickup_location:
            booking.pickupLocation,

          dropoff_location:
            booking.dropoffLocation,

          scheduled_at:
            booking.scheduledAt,

          status:
            booking.status,

          fare:
            booking.fare,

          updated_at:
            this.db.fn.now()
        })
        .returning("*");

    if (!row) {
      return undefined;
    }

    return this.mapBooking(row);
  }
}
EOF

echo
echo "==> Creating Booking service..."

cat > src/services/bookingService.ts <<'EOF'
import {
  Booking,
  BookingStatus
} from "../types/booking";

import {
  BookingRepository
} from "../repositories/bookingRepository";

export class BookingService {

  constructor(
    private repository:
      BookingRepository
  ) {}

  async getAllBookings():
    Promise<Booking[]> {

    return this.repository
      .findAll();
  }

  async getBookingById(
    id: string
  ):
    Promise<
      Booking | undefined
    > {

    return this.repository
      .findById(id);
  }

  async createBooking(
    booking: Booking
  ): Promise<Booking> {

    return this.repository
      .create(booking);
  }

  async updateBooking(
    id: string,

    data: Omit<
      Booking,
      "id" | "status"
    >
  ):
    Promise<
      Booking | undefined
    > {

    const existing =
      await this.repository
        .findById(id);

    if (!existing) {
      return undefined;
    }

    return this.repository.update(
      id,
      {
        id,

        ...data,

        status:
          existing.status
      }
    );
  }

  async updateBookingStatus(
    id: string,

    status: BookingStatus
  ):
    Promise<
      Booking | undefined
    > {

    const existing =
      await this.repository
        .findById(id);

    if (!existing) {
      return undefined;
    }

    return this.repository.update(
      id,
      {
        ...existing,

        status
      }
    );
  }
}
EOF

echo
echo "==> Creating Booking controller..."

cat > src/controllers/bookingController.ts <<'EOF'
import {
  Request,
  Response
} from "express";

import {
  randomUUID
} from "crypto";

import {
  BookingService
} from "../services/bookingService";

import {
  createBookingSchema,
  updateBookingSchema,
  updateBookingStatusSchema
} from "../types/bookingSchema";

export class BookingController {

  constructor(
    private service:
      BookingService
  ) {}

  getAllBookings =
    async (
      _req: Request,
      res: Response
    ) => {

      const bookings =
        await this.service
          .getAllBookings();

      return res.json(bookings);
    };

  getBookingById =
    async (
      req: Request,
      res: Response
    ) => {

      const id =
        String(req.params.id);

      const booking =
        await this.service
          .getBookingById(id);

      if (!booking) {

        return res
          .status(404)
          .json({
            message:
              "Booking not found"
          });
      }

      return res.json(booking);
    };

  createBooking =
    async (
      req: Request,
      res: Response
    ) => {

      const result =
        createBookingSchema
          .safeParse(req.body);

      if (!result.success) {

        return res
          .status(400)
          .json({
            message:
              "Invalid booking data",

            errors:
              result.error.flatten()
          });
      }

      const booking =
        await this.service
          .createBooking({

            id:
              randomUUID(),

            ...result.data
          });

      return res
        .status(201)
        .json(booking);
    };

  updateBooking =
    async (
      req: Request,
      res: Response
    ) => {

      const result =
        updateBookingSchema
          .safeParse(req.body);

      if (!result.success) {

        return res
          .status(400)
          .json({
            message:
              "Invalid booking data",

            errors:
              result.error.flatten()
          });
      }

      const id =
        String(req.params.id);

      const booking =
        await this.service
          .updateBooking(
            id,
            result.data
          );

      if (!booking) {

        return res
          .status(404)
          .json({
            message:
              "Booking not found"
          });
      }

      return res.json(booking);
    };

  updateBookingStatus =
    async (
      req: Request,
      res: Response
    ) => {

      const result =
        updateBookingStatusSchema
          .safeParse(req.body);

      if (!result.success) {

        return res
          .status(400)
          .json({
            message:
              "Invalid booking status",

            errors:
              result.error.flatten()
          });
      }

      const id =
        String(req.params.id);

      const booking =
        await this.service
          .updateBookingStatus(
            id,
            result.data.status
          );

      if (!booking) {

        return res
          .status(404)
          .json({
            message:
              "Booking not found"
          });
      }

      return res.json(booking);
    };
}
EOF

echo
echo "==> Creating async error middleware..."

cat > src/middleware/asyncHandler.ts <<'EOF'
import {
  RequestHandler
} from "express";

export function asyncHandler(
  handler: RequestHandler
): RequestHandler {

  return (
    req,
    res,
    next
  ) => {

    Promise
      .resolve(
        handler(
          req,
          res,
          next
        )
      )
      .catch(next);
  };
}
EOF

echo
echo "==> Creating error handler..."

cat > src/middleware/errorHandler.ts <<'EOF'
import {
  Request,
  Response,
  NextFunction
} from "express";

export function errorHandler(
  err: any,

  _req: Request,

  res: Response,

  _next: NextFunction
) {

  console.error(err);

  if (
    err?.code === "23505"
  ) {

    return res
      .status(409)
      .json({
        message:
          "Duplicate booking data",

        detail:
          err.detail
      });
  }

  return res
    .status(500)
    .json({
      message:
        "Internal server error"
    });
}
EOF

echo
echo "==> Creating routes..."

cat > src/routes/bookingRoutes.ts <<'EOF'
import {
  Router
} from "express";

import {
  BookingController
} from "../controllers/bookingController";

import {
  asyncHandler
} from "../middleware/asyncHandler";

export function createBookingRoutes(
  controller: BookingController
): Router {

  const router =
    Router();

  router.get(
    "/",
    asyncHandler(
      controller.getAllBookings
    )
  );

  router.get(
    "/:id",
    asyncHandler(
      controller.getBookingById
    )
  );

  router.post(
    "/",
    asyncHandler(
      controller.createBooking
    )
  );

  router.put(
    "/:id",
    asyncHandler(
      controller.updateBooking
    )
  );

  router.patch(
    "/:id/status",
    asyncHandler(
      controller.updateBookingStatus
    )
  );

  return router;
}
EOF

echo
echo "==> Creating server..."

cat > src/server.ts <<'EOF'
import express from "express";

import db from "./database";

import {
  BookingRepository
} from "./repositories/bookingRepository";

import {
  BookingService
} from "./services/bookingService";

import {
  BookingController
} from "./controllers/bookingController";

import {
  createBookingRoutes
} from "./routes/bookingRoutes";

import {
  errorHandler
} from "./middleware/errorHandler";

const app =
  express();

app.use(
  express.json()
);

const repository =
  new BookingRepository(db);

const service =
  new BookingService(
    repository
  );

const controller =
  new BookingController(
    service
  );

app.get(
  "/health",
  async (
    _req,
    res
  ) => {

    try {

      await db.raw(
        "SELECT 1"
      );

      return res.json({
        service:
          "booking-service",

        status:
          "UP",

        database:
          "UP"
      });

    } catch {

      return res
        .status(503)
        .json({

          service:
            "booking-service",

          status:
            "UP",

          database:
            "DOWN"
        });
    }
  }
);

app.use(
  "/bookings",
  createBookingRoutes(
    controller
  )
);

app.use(
  errorHandler
);

const PORT =
  process.env.PORT ||
  3004;

app.listen(
  PORT,
  () => {

    console.log(
      `Booking service running on port ${PORT}`
    );
  }
);
EOF

echo
echo "==> Creating .gitignore..."

cat > .gitignore <<'EOF'
node_modules/
dist/
.env
*.log
EOF

echo
echo "=========================================="
echo " Creating PostgreSQL schema"
echo "=========================================="

sudo -u postgres psql \
  -d "$DB_NAME" \
  -c "CREATE SCHEMA IF NOT EXISTS $DB_SCHEMA AUTHORIZATION $DB_USER;"

sudo -u postgres psql \
  -d "$DB_NAME" \
  -c "GRANT USAGE, CREATE ON SCHEMA $DB_SCHEMA TO $DB_USER;"

echo
echo "==> Running migration..."

npm run migrate

echo
echo "==> Building Booking Service..."

npm run build

echo
echo "==> Creating smoke test..."

cat > smoke-test.sh <<'EOF'
#!/usr/bin/env bash

set -euo pipefail

BASE_URL="http://localhost:3004"

echo
echo "=========================================="
echo " Booking Service Smoke Test"
echo "=========================================="

echo
echo "1. Health check"

curl -fsS \
  "$BASE_URL/health"

echo

echo
echo "2. Create booking"

CREATE_RESPONSE=$(
  curl -fsS \
    -X POST \
    "$BASE_URL/bookings" \
    -H "Content-Type: application/json" \
    -d '{
      "userId": "user-smoke-001",
      "driverId": "driver-001",
      "pickupLocation": "MG Road, Bengaluru",
      "dropoffLocation": "Kempegowda International Airport",
      "scheduledAt": "2030-01-01T10:00:00+05:30",
      "fare": 850
    }'
)

echo "$CREATE_RESPONSE"

BOOKING_ID=$(
  printf '%s' "$CREATE_RESPONSE" |
  sed -n 's/.*"id":"\([^"]*\)".*/\1/p'
)

if [ -z "$BOOKING_ID" ]; then
  echo "ERROR: Could not get booking ID"
  exit 1
fi

echo
echo "3. Get booking"

curl -fsS \
  "$BASE_URL/bookings/$BOOKING_ID"

echo

echo
echo "4. Update booking"

curl -fsS \
  -X PUT \
  "$BASE_URL/bookings/$BOOKING_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-smoke-001",
    "driverId": "driver-001",
    "pickupLocation": "Indiranagar, Bengaluru",
    "dropoffLocation": "Kempegowda International Airport",
    "scheduledAt": "2030-01-01T11:00:00+05:30",
    "fare": 900
  }'

echo

echo
echo "5. Update status"

curl -fsS \
  -X PATCH \
  "$BASE_URL/bookings/$BOOKING_ID/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "CONFIRMED"
  }'

echo

echo
echo "6. Get all bookings"

curl -fsS \
  "$BASE_URL/bookings"

echo

echo
echo "7. Test validation"

curl -s \
  -o /tmp/booking-validation.json \
  -w "HTTP %{http_code}\n" \
  -X PATCH \
  "$BASE_URL/bookings/$BOOKING_ID/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "WRONG"
  }'

cat /tmp/booking-validation.json

echo

echo
echo "8. Cleanup smoke-test booking"

sudo -u postgres psql \
  -d jhanvi_cars \
  -c "DELETE FROM booking_schema.bookings WHERE id = '$BOOKING_ID';" \
  >/dev/null

echo "Deleted smoke-test booking:"
echo "$BOOKING_ID"

echo
echo "=========================================="
echo " Smoke Test Complete"
echo "=========================================="
EOF

chmod +x smoke-test.sh

echo
echo "==> Creating systemd service..."

CURRENT_USER="$(id -un)"
CURRENT_HOME="$HOME"

sudo tee \
  "/etc/systemd/system/$SERVICE_NAME.service" \
  >/dev/null <<EOF
[Unit]
Description=Jhanvi Cars Booking Service
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$SERVICE_DIR
EnvironmentFile=$SERVICE_DIR/.env
ExecStart=/usr/bin/node $SERVICE_DIR/dist/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo
echo "==> Reloading systemd..."

sudo systemctl daemon-reload

echo
echo "==> Enabling Booking Service..."

sudo systemctl enable "$SERVICE_NAME"

echo
echo "==> Starting Booking Service..."

sudo systemctl start "$SERVICE_NAME"

sleep 2

echo
echo "=========================================="
echo " Booking Service Status"
echo "=========================================="

sudo systemctl status \
  "$SERVICE_NAME" \
  --no-pager

echo
echo "=========================================="
echo " Health Check"
echo "=========================================="

curl -fsS \
  "http://localhost:$PORT/health"

echo

echo
echo "=========================================="
echo " Booking Service Setup Complete"
echo "=========================================="

echo
echo "Project:"
echo "$SERVICE_DIR"

echo
echo "Port:"
echo "$PORT"

echo
echo "Schema:"
echo "$DB_SCHEMA"

echo
echo "Systemd:"
echo "$SERVICE_NAME"

echo
echo "Smoke test:"
echo "$SERVICE_DIR/smoke-test.sh"

echo
echo "Useful commands:"
echo
echo "  sudo systemctl status $SERVICE_NAME"
echo "  sudo systemctl restart $SERVICE_NAME"
echo "  sudo journalctl -u $SERVICE_NAME -f"
echo "  cd $SERVICE_DIR && ./smoke-test.sh"
