"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const config = {
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
exports.default = config;
