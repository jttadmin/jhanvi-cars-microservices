#!/bin/bash

set -e

echo "========================================"
echo " Setting up Jhanvi Cars Driver Service"
echo "========================================"

DRIVER_DIR="$HOME/jhanvi-dev/driver-service"
USER_DIR="$HOME/jhanvi-dev/user-service"

cd "$DRIVER_DIR"

echo
echo "1. Installing dependencies..."

npm install express@4.19.2 dotenv@16.4.5 knex@3.1.0 pg@8.12.0 zod@3.23.8 uuid@9.0.1

npm install -D \
  typescript@5.5.3 \
  ts-node@10.9.2 \
  ts-node-dev@2.0.0 \
  @types/node \
  @types/express \
  @types/uuid

echo
echo "2. Creating directories..."

mkdir -p src/controllers
mkdir -p src/repositories
mkdir -p src/routes
mkdir -p src/services
mkdir -p src/types
mkdir -p migrations

echo
echo "3. Creating tsconfig.json..."

cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
EOF

echo
echo "4. Creating package scripts..."

npm pkg set main="dist/server.js"

npm pkg set scripts.build="tsc -p tsconfig.json"
npm pkg set scripts.start="node dist/server.js"
npm pkg set scripts.dev="ts-node-dev --respawn --transpile-only src/server.ts"
npm pkg set scripts.migrate="knex --knexfile knexfile.ts migrate:latest"
npm pkg set scripts.migrate:rollback="knex --knexfile knexfile.ts migrate:rollback"

echo
echo "5. Creating knexfile.ts..."

cat > knexfile.ts <<'EOF'
import type { Knex } from "knex";

import "dotenv/config";

const config: {
  [key: string]: Knex.Config;
} = {
  development: {
    client: "pg",

    connection: process.env.DATABASE_URL,

    searchPath: [
      process.env.DB_SCHEMA ?? "driver_schema",
      "public"
    ],

    migrations: {
      directory: "./migrations",
      tableName: "knex_migrations_driver",
      extension: "ts"
    }
  }
};

export default config;
EOF

echo
echo "6. Creating .env..."

if [ -f "$USER_DIR/.env" ]; then

  DATABASE_URL_VALUE=$(grep '^DATABASE_URL=' "$USER_DIR/.env" | cut -d '=' -f2-)

  if [ -z "$DATABASE_URL_VALUE" ]; then
    echo "ERROR: DATABASE_URL was not found in user-service/.env"
    exit 1
  fi

  cat > .env <<EOF
DATABASE_URL=$DATABASE_URL_VALUE
DB_SCHEMA=driver_schema
PORT=3003
EOF

  echo "Copied DATABASE_URL configuration from user-service."
  echo "Driver service will use driver_schema."

else

  echo "ERROR: $USER_DIR/.env was not found."
  exit 1
fi

echo
echo "7. Creating driver type..."

cat > src/types/driver.ts <<'EOF'
export interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  licenseNumber: string;
  vehicleNumber: string;
  isAvailable: boolean;
}
EOF

echo
echo "8. Creating database repository..."

cat > src/repositories/driverRepository.ts <<'EOF'
import { Knex } from "knex";
import { Driver } from "../types/driver";

export class DriverRepository {
  private db: Knex;

  constructor(db: Knex) {
    this.db = db;
  }

  async findAll(): Promise<Driver[]> {
    return this.db("drivers")
      .select("*")
      .orderBy("created_at", "desc");
  }

  async findById(id: string): Promise<Driver | undefined> {
    return this.db("drivers")
      .where({ id })
      .first();
  }

  async create(driver: Driver): Promise<Driver> {
    const [createdDriver] = await this.db("drivers")
      .insert({
        id: driver.id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        license_number: driver.licenseNumber,
        vehicle_number: driver.vehicleNumber,
        is_available: driver.isAvailable
      })
      .returning("*");

    return {
      id: createdDriver.id,
      name: createdDriver.name,
      email: createdDriver.email,
      phone: createdDriver.phone,
      licenseNumber: createdDriver.license_number,
      vehicleNumber: createdDriver.vehicle_number,
      isAvailable: createdDriver.is_available
    };
  }

  async update(
    id: string,
    driver: Driver
  ): Promise<Driver | undefined> {
    const [updatedDriver] = await this.db("drivers")
      .where({ id })
      .update({
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        license_number: driver.licenseNumber,
        vehicle_number: driver.vehicleNumber,
        is_available: driver.isAvailable,
        updated_at: this.db.fn.now()
      })
      .returning("*");

    if (!updatedDriver) {
      return undefined;
    }

    return {
      id: updatedDriver.id,
      name: updatedDriver.name,
      email: updatedDriver.email,
      phone: updatedDriver.phone,
      licenseNumber: updatedDriver.license_number,
      vehicleNumber: updatedDriver.vehicle_number,
      isAvailable: updatedDriver.is_available
    };
  }
}
EOF

echo
echo "9. Creating database migration..."

cat > migrations/001_create_drivers.ts <<'EOF'
import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE SCHEMA IF NOT EXISTS driver_schema;
  `);

  const exists = await knex.schema
    .withSchema("driver_schema")
    .hasTable("drivers");

  if (!exists) {
    await knex.schema
      .withSchema("driver_schema")
      .createTable("drivers", (table) => {
        table.string("id").primary();

        table.string("name").notNullable();

        table.string("email").notNullable().unique();

        table.string("phone").notNullable();

        table.string("license_number").notNullable().unique();

        table.string("vehicle_number").notNullable().unique();

        table.boolean("is_available")
          .notNullable()
          .defaultTo(false);

        table.timestamp("created_at")
          .notNullable()
          .defaultTo(knex.fn.now());

        table.timestamp("updated_at")
          .notNullable()
          .defaultTo(knex.fn.now());
      });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema("driver_schema")
    .dropTableIfExists("drivers");
}
EOF

echo
echo "10. Creating database client..."

cat > src/database.ts <<'EOF'
import knex from "knex";
import config from "../knexfile";

const db = knex(config.development);

export default db;
EOF

echo
echo "11. Creating service layer..."

cat > src/services/driverService.ts <<'EOF'
import { Driver } from "../types/driver";
import { DriverRepository } from "../repositories/driverRepository";

export class DriverService {
  private repository: DriverRepository;

  constructor(repository: DriverRepository) {
    this.repository = repository;
  }

  async getAllDrivers(): Promise<Driver[]> {
    return this.repository.findAll();
  }

  async getDriverById(id: string): Promise<Driver | undefined> {
    return this.repository.findById(id);
  }

  async createDriver(driver: Driver): Promise<Driver> {
    return this.repository.create(driver);
  }

  async updateDriver(
    id: string,
    driver: Driver
  ): Promise<Driver | undefined> {
    return this.repository.update(id, driver);
  }

  async updateDriverStatus(
    id: string,
    isAvailable: boolean
  ): Promise<Driver | undefined> {
    const driver = await this.repository.findById(id);

    if (!driver) {
      return undefined;
    }

    return this.repository.update(id, {
      ...driver,
      isAvailable
    });
  }
}
EOF

echo
echo "12. Creating controller..."

cat > src/controllers/driverController.ts <<'EOF'
import { Request, Response } from "express";
import { DriverService } from "../services/driverService";

export class DriverController {
  constructor(private service: DriverService) {}

  getAllDrivers = async (_req: Request, res: Response) => {
    const drivers = await this.service.getAllDrivers();

    return res.json(drivers);
  };

  getDriverById = async (req: Request, res: Response) => {
    const driver = await this.service.getDriverById(req.params.id);

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found"
      });
    }

    return res.json(driver);
  };

  createDriver = async (req: Request, res: Response) => {
    const driver = await this.service.createDriver(req.body);

    return res.status(201).json(driver);
  };

  updateDriver = async (req: Request, res: Response) => {
    const driver = await this.service.updateDriver(
      req.params.id,
      req.body
    );

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found"
      });
    }

    return res.json(driver);
  };

  updateDriverStatus = async (req: Request, res: Response) => {
    const driver = await this.service.updateDriverStatus(
      req.params.id,
      req.body.isAvailable
    );

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found"
      });
    }

    return res.json(driver);
  };
}
EOF

echo
echo "13. Creating routes..."

cat > src/routes/driverRoutes.ts <<'EOF'
import { Router } from "express";
import { DriverController } from "../controllers/driverController";

export function createDriverRoutes(
  controller: DriverController
): Router {
  const router = Router();

  router.get("/", controller.getAllDrivers);
  router.get("/:id", controller.getDriverById);
  router.post("/", controller.createDriver);
  router.put("/:id", controller.updateDriver);
  router.patch("/:id/status", controller.updateDriverStatus);

  return router;
}
EOF

echo
echo "14. Creating server..."

cat > src/server.ts <<'EOF'
import express from "express";

import db from "./database";
import { DriverRepository } from "./repositories/driverRepository";
import { DriverService } from "./services/driverService";
import { DriverController } from "./controllers/driverController";
import { createDriverRoutes } from "./routes/driverRoutes";

const app = express();

app.use(express.json());

const repository = new DriverRepository(db);
const service = new DriverService(repository);
const controller = new DriverController(service);

app.get("/health", async (_req, res) => {
  try {
    await db.raw("SELECT 1");

    return res.json({
      service: "driver-service",
      status: "UP",
      database: "UP"
    });
  } catch {
    return res.status(503).json({
      service: "driver-service",
      status: "UP",
      database: "DOWN"
    });
  }
});

app.use("/drivers", createDriverRoutes(controller));

const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
  console.log(`Driver service running on port ${PORT}`);
});
EOF

echo
echo "15. Creating .gitignore..."

cat > .gitignore <<'EOF'
node_modules/
dist/
.env
*.log
EOF

echo
echo "16. Checking TypeScript..."

npm run build

echo
echo "========================================"
echo " Driver Service setup completed!"
echo "========================================"

echo
echo "Next commands:"
echo
echo "  cd ~/jhanvi-dev/driver-service"
echo "  npm run migrate"
echo "  npm run dev"
echo
echo "Service:"
echo "  http://localhost:3003"
echo
