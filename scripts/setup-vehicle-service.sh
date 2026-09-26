#!/usr/bin/env bash

set -euo pipefail

SERVICE_NAME="vehicle-service"
SERVICE_DIR="$HOME/jhanvi-dev/vehicle-service"
PORT="3005"
DB_SCHEMA="vehicle_schema"
DB_NAME="jhanvi_cars"
DB_USER="user_user"

echo "=========================================="
echo " Jhanvi Cars - Vehicle Service Setup"
echo "=========================================="

echo
echo "==> Reading database configuration..."

if [ ! -f "$HOME/jhanvi-dev/user-service/.env" ]; then
  echo "ERROR: user-service/.env not found"
  exit 1
fi

DATABASE_URL=$(grep '^DATABASE_URL=' \
  "$HOME/jhanvi-dev/user-service/.env" |
  head -n 1 |
  cut -d= -f2-)

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not found"
  exit 1
fi

echo "Database configuration found."

echo
echo "==> Stopping existing Vehicle Service..."

sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || true

echo
echo "==> Checking port $PORT..."

if sudo lsof -i :"$PORT" >/dev/null 2>&1; then
  echo "ERROR: Port $PORT is already in use."
  sudo lsof -i :"$PORT"
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
  "name": "vehicle-service",
  "version": "1.0.0",
  "description": "Jhanvi Cars Vehicle Service",
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
echo "==> Creating tsconfig.json..."

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
echo "==> Creating .env..."

cat > .env <<EOF
DATABASE_URL=$DATABASE_URL
DB_SCHEMA=$DB_SCHEMA
PORT=$PORT
EOF

echo
echo "==> Creating knexfile.ts..."

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
        "vehicle_schema",
      "public"
    ],

    migrations: {
      directory:
        "./migrations",

      tableName:
        "knex_migrations_vehicle",

      extension:
        "ts",

      schemaName:
        process.env.DB_SCHEMA ??
        "vehicle_schema"
    }
  }
};

export default config;
EOF

echo
echo "==> Creating database.ts..."

cat > src/database.ts <<'EOF'
import knex from "knex";

import "dotenv/config";

const db = knex({
  client: "pg",

  connection:
    process.env.DATABASE_URL,

  searchPath: [
    process.env.DB_SCHEMA ??
      "vehicle_schema",
    "public"
  ]
});

export default db;
EOF

echo
echo "==> Creating Vehicle type..."

cat > src/types/vehicle.ts <<'EOF'
export type VehicleType =
  | "SEDAN"
  | "SUV"
  | "HATCHBACK"
  | "LUXURY"
  | "MUV";

export type VehicleStatus =
  | "AVAILABLE"
  | "IN_USE"
  | "MAINTENANCE"
  | "INACTIVE";

export interface Vehicle {
  id: string;
  driverId?: string | null;
  registrationNumber: string;
  make: string;
  model: string;
  year: number;
  type: VehicleType;
  status: VehicleStatus;
}
EOF

echo
echo "==> Creating Zod schemas..."

cat > src/types/vehicleSchema.ts <<'EOF'
import { z } from "zod";

export const vehicleTypeSchema =
  z.enum([
    "SEDAN",
    "SUV",
    "HATCHBACK",
    "LUXURY",
    "MUV"
  ]);

export const vehicleStatusSchema =
  z.enum([
    "AVAILABLE",
    "IN_USE",
    "MAINTENANCE",
    "INACTIVE"
  ]);

export const createVehicleSchema =
  z.object({
    driverId:
      z.string().min(1).nullable().optional(),

    registrationNumber:
      z.string()
        .min(3)
        .max(20),

    make:
      z.string().min(2),

    model:
      z.string().min(1),

    year:
      z.number()
        .int()
        .min(1900)
        .max(2100),

    type:
      vehicleTypeSchema,

    status:
      vehicleStatusSchema
        .optional()
        .default("AVAILABLE")
  });

export const updateVehicleSchema =
  z.object({
    driverId:
      z.string().min(1).nullable().optional(),

    registrationNumber:
      z.string()
        .min(3)
        .max(20),

    make:
      z.string().min(2),

    model:
      z.string().min(1),

    year:
      z.number()
        .int()
        .min(1900)
        .max(2100),

    type:
      vehicleTypeSchema
  });

export const updateVehicleStatusSchema =
  z.object({
    status:
      vehicleStatusSchema
  });
EOF

echo
echo "==> Creating migration..."

cat > migrations/001_create_vehicles.ts <<'EOF'
import { Knex } from "knex";

export async function up(
  knex: Knex
): Promise<void> {

  await knex.schema
    .withSchema("vehicle_schema")
    .createTable(
      "vehicles",
      (table) => {

        table
          .string("id")
          .primary();

        table
          .string("driver_id")
          .nullable();

        table
          .string("registration_number")
          .notNullable()
          .unique();

        table
          .string("make")
          .notNullable();

        table
          .string("model")
          .notNullable();

        table
          .integer("year")
          .notNullable();

        table
          .string("type")
          .notNullable();

        table
          .string("status")
          .notNullable()
          .defaultTo("AVAILABLE");

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
          "driver_id"
        ]);

        table.index([
          "status"
        ]);

        table.index([
          "type"
        ]);
      }
    );
}

export async function down(
  knex: Knex
): Promise<void> {

  await knex.schema
    .withSchema("vehicle_schema")
    .dropTableIfExists(
      "vehicles"
    );
}
EOF

echo
echo "==> Creating repository..."

cat > src/repositories/vehicleRepository.ts <<'EOF'
import { Knex } from "knex";

import {
  Vehicle,
  VehicleStatus,
  VehicleType
} from "../types/vehicle";

export class VehicleRepository {

  constructor(
    private db: Knex
  ) {}

  private mapVehicle(
    row: any
  ): Vehicle {

    return {
      id: row.id,

      driverId:
        row.driver_id,

      registrationNumber:
        row.registration_number,

      make:
        row.make,

      model:
        row.model,

      year:
        row.year,

      type:
        row.type as VehicleType,

      status:
        row.status as VehicleStatus
    };
  }

  async findAll():
    Promise<Vehicle[]> {

    const rows =
      await this.db("vehicles")
        .select("*")
        .orderBy(
          "created_at",
          "desc"
        );

    return rows.map(
      (row) =>
        this.mapVehicle(row)
    );
  }

  async findById(
    id: string
  ):
    Promise<
      Vehicle | undefined
    > {

    const row =
      await this.db("vehicles")
        .where({ id })
        .first();

    if (!row) {
      return undefined;
    }

    return this.mapVehicle(row);
  }

  async create(
    vehicle: Vehicle
  ): Promise<Vehicle> {

    const [row] =
      await this.db("vehicles")
        .insert({
          id:
            vehicle.id,

          driver_id:
            vehicle.driverId ??
            null,

          registration_number:
            vehicle.registrationNumber,

          make:
            vehicle.make,

          model:
            vehicle.model,

          year:
            vehicle.year,

          type:
            vehicle.type,

          status:
            vehicle.status
        })
        .returning("*");

    return this.mapVehicle(row);
  }

  async update(
    id: string,
    vehicle: Vehicle
  ):
    Promise<
      Vehicle | undefined
    > {

    const [row] =
      await this.db("vehicles")
        .where({ id })
        .update({

          driver_id:
            vehicle.driverId ??
            null,

          registration_number:
            vehicle.registrationNumber,

          make:
            vehicle.make,

          model:
            vehicle.model,

          year:
            vehicle.year,

          type:
            vehicle.type,

          status:
            vehicle.status,

          updated_at:
            this.db.fn.now()
        })
        .returning("*");

    if (!row) {
      return undefined;
    }

    return this.mapVehicle(row);
  }
}
EOF

echo
echo "==> Creating service..."

cat > src/services/vehicleService.ts <<'EOF'
import {
  Vehicle,
  VehicleStatus
} from "../types/vehicle";

import {
  VehicleRepository
} from "../repositories/vehicleRepository";

export class VehicleService {

  constructor(
    private repository:
      VehicleRepository
  ) {}

  async getAllVehicles():
    Promise<Vehicle[]> {

    return this.repository
      .findAll();
  }

  async getVehicleById(
    id: string
  ):
    Promise<
      Vehicle | undefined
    > {

    return this.repository
      .findById(id);
  }

  async createVehicle(
    vehicle: Vehicle
  ): Promise<Vehicle> {

    return this.repository
      .create(vehicle);
  }

  async updateVehicle(
    id: string,

    data: Omit<
      Vehicle,
      "id" | "status"
    >
  ):
    Promise<
      Vehicle | undefined
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

  async updateVehicleStatus(
    id: string,

    status: VehicleStatus
  ):
    Promise<
      Vehicle | undefined
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
echo "==> Creating controller..."

cat > src/controllers/vehicleController.ts <<'EOF'
import {
  Request,
  Response
} from "express";

import {
  randomUUID
} from "crypto";

import {
  VehicleService
} from "../services/vehicleService";

import {
  createVehicleSchema,
  updateVehicleSchema,
  updateVehicleStatusSchema
} from "../types/vehicleSchema";

export class VehicleController {

  constructor(
    private service:
      VehicleService
  ) {}

  getAllVehicles =
    async (
      _req: Request,
      res: Response
    ) => {

      const vehicles =
        await this.service
          .getAllVehicles();

      return res.json(vehicles);
    };

  getVehicleById =
    async (
      req: Request,
      res: Response
    ) => {

      const id =
        String(req.params.id);

      const vehicle =
        await this.service
          .getVehicleById(id);

      if (!vehicle) {

        return res
          .status(404)
          .json({
            message:
              "Vehicle not found"
          });
      }

      return res.json(vehicle);
    };

  createVehicle =
    async (
      req: Request,
      res: Response
    ) => {

      const result =
        createVehicleSchema
          .safeParse(req.body);

      if (!result.success) {

        return res
          .status(400)
          .json({
            message:
              "Invalid vehicle data",

            errors:
              result.error.flatten()
          });
      }

      const vehicle =
        await this.service
          .createVehicle({

            id:
              randomUUID(),

            ...result.data
          });

      return res
        .status(201)
        .json(vehicle);
    };

  updateVehicle =
    async (
      req: Request,
      res: Response
    ) => {

      const result =
        updateVehicleSchema
          .safeParse(req.body);

      if (!result.success) {

        return res
          .status(400)
          .json({
            message:
              "Invalid vehicle data",

            errors:
              result.error.flatten()
          });
      }

      const id =
        String(req.params.id);

      const vehicle =
        await this.service
          .updateVehicle(
            id,
            result.data
          );

      if (!vehicle) {

        return res
          .status(404)
          .json({
            message:
              "Vehicle not found"
          });
      }

      return res.json(vehicle);
    };

  updateVehicleStatus =
    async (
      req: Request,
      res: Response
    ) => {

      const result =
        updateVehicleStatusSchema
          .safeParse(req.body);

      if (!result.success) {

        return res
          .status(400)
          .json({
            message:
              "Invalid vehicle status",

            errors:
              result.error.flatten()
          });
      }

      const id =
        String(req.params.id);

      const vehicle =
        await this.service
          .updateVehicleStatus(
            id,
            result.data.status
          );

      if (!vehicle) {

        return res
          .status(404)
          .json({
            message:
              "Vehicle not found"
          });
      }

      return res.json(vehicle);
    };
}
EOF

echo
echo "==> Creating asyncHandler..."

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
          "Duplicate vehicle data",

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

cat > src/routes/vehicleRoutes.ts <<'EOF'
import {
  Router
} from "express";

import {
  VehicleController
} from "../controllers/vehicleController";

import {
  asyncHandler
} from "../middleware/asyncHandler";

export function createVehicleRoutes(
  controller: VehicleController
): Router {

  const router =
    Router();

  router.get(
    "/",
    asyncHandler(
      controller.getAllVehicles
    )
  );

  router.get(
    "/:id",
    asyncHandler(
      controller.getVehicleById
    )
  );

  router.post(
    "/",
    asyncHandler(
      controller.createVehicle
    )
  );

  router.put(
    "/:id",
    asyncHandler(
      controller.updateVehicle
    )
  );

  router.patch(
    "/:id/status",
    asyncHandler(
      controller.updateVehicleStatus
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
  VehicleRepository
} from "./repositories/vehicleRepository";

import {
  VehicleService
} from "./services/vehicleService";

import {
  VehicleController
} from "./controllers/vehicleController";

import {
  createVehicleRoutes
} from "./routes/vehicleRoutes";

import {
  errorHandler
} from "./middleware/errorHandler";

const app =
  express();

app.use(
  express.json()
);

const repository =
  new VehicleRepository(db);

const service =
  new VehicleService(
    repository
  );

const controller =
  new VehicleController(
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
          "vehicle-service",

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
            "vehicle-service",

          status:
            "UP",

          database:
            "DOWN"
        });
    }
  }
);

app.use(
  "/vehicles",
  createVehicleRoutes(
    controller
  )
);

app.use(
  errorHandler
);

const PORT =
  process.env.PORT ||
  3005;

app.listen(
  PORT,
  () => {

    console.log(
      `Vehicle service running on port ${PORT}`
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
echo "==> Building Vehicle Service..."

npm run build

echo
echo "==> Creating smoke test..."

cat > smoke-test.sh <<'EOF'
#!/usr/bin/env bash

set -euo pipefail

BASE_URL="http://localhost:3005"

echo
echo "=========================================="
echo " Vehicle Service Smoke Test"
echo "=========================================="

echo
echo "1. Health check"

curl -fsS \
  "$BASE_URL/health"

echo

echo
echo "2. Create vehicle"

CREATE_RESPONSE=$(
  curl -fsS \
    -X POST \
    "$BASE_URL/vehicles" \
    -H "Content-Type: application/json" \
    -d '{
      "driverId": "driver-001",
      "registrationNumber": "SMOKE1234",
      "make": "Toyota",
      "model": "Innova",
      "year": 2025,
      "type": "MUV"
    }'
)

echo "$CREATE_RESPONSE"

VEHICLE_ID=$(
  printf '%s' "$CREATE_RESPONSE" |
  sed -n 's/.*"id":"\([^"]*\)".*/\1/p'
)

if [ -z "$VEHICLE_ID" ]; then
  echo "ERROR: Could not get vehicle ID"
  exit 1
fi

echo
echo "3. Get vehicle"

curl -fsS \
  "$BASE_URL/vehicles/$VEHICLE_ID"

echo

echo
echo "4. Update vehicle"

curl -fsS \
  -X PUT \
  "$BASE_URL/vehicles/$VEHICLE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "driverId": "driver-001",
    "registrationNumber": "SMOKE1234",
    "make": "Toyota",
    "model": "Innova Crysta",
    "year": 2025,
    "type": "MUV"
  }'

echo

echo
echo "5. Update status"

curl -fsS \
  -X PATCH \
  "$BASE_URL/vehicles/$VEHICLE_ID/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_USE"
  }'

echo

echo
echo "6. Get all vehicles"

curl -fsS \
  "$BASE_URL/vehicles"

echo

echo
echo "7. Test validation"

curl -s \
  -o /tmp/vehicle-validation.json \
  -w "HTTP %{http_code}\n" \
  -X PATCH \
  "$BASE_URL/vehicles/$VEHICLE_ID/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "WRONG"
  }'

cat /tmp/vehicle-validation.json

echo

echo
echo "8. Test duplicate registration number"

curl -s \
  -o /tmp/vehicle-duplicate.json \
  -w "HTTP %{http_code}\n" \
  -X POST \
  "$BASE_URL/vehicles" \
  -H "Content-Type: application/json" \
  -d '{
    "driverId": "driver-001",
    "registrationNumber": "SMOKE1234",
    "make": "Honda",
    "model": "City",
    "year": 2025,
    "type": "SEDAN"
  }'

cat /tmp/vehicle-duplicate.json

echo

echo
echo "9. Cleanup smoke-test vehicle"

sudo -u postgres psql \
  -d jhanvi_cars \
  -c "DELETE FROM vehicle_schema.vehicles WHERE id = '$VEHICLE_ID';" \
  >/dev/null

echo "Deleted smoke-test vehicle:"
echo "$VEHICLE_ID"

echo
echo "=========================================="
echo " Smoke Test Complete"
echo "=========================================="
EOF

chmod +x smoke-test.sh

echo
echo "==> Creating systemd service..."

CURRENT_USER="$(id -un)"

sudo tee \
  "/etc/systemd/system/$SERVICE_NAME.service" \
  >/dev/null <<EOF
[Unit]
Description=Jhanvi Cars Vehicle Service
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
echo "==> Enabling Vehicle Service..."

sudo systemctl enable "$SERVICE_NAME"

echo
echo "==> Starting Vehicle Service..."

sudo systemctl start "$SERVICE_NAME"

sleep 2

echo
echo "=========================================="
echo " Vehicle Service Status"
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
echo " Vehicle Service Setup Complete"
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
