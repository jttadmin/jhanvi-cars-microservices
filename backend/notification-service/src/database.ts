import knex from "knex";
import "dotenv/config";

const schema = process.env.DB_SCHEMA ?? "notification_schema";

const db = knex({
  client: "pg",
  connection: process.env.DATABASE_URL,
  searchPath: [schema, "public"]
});

export default db;
