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
      extension: "ts",
      schemaName: process.env.DB_SCHEMA ?? "driver_schema"
    }
  }
};

export default config;
