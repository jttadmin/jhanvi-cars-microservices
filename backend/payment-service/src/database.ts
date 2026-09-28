import knex from "knex";
import "dotenv/config";

const schema = process.env.DB_SCHEMA ?? "payment_schema";

export default knex({
  client: "pg",
  connection: process.env.DATABASE_URL,
  searchPath: [schema, "public"]
});
