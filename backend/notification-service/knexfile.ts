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
