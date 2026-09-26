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
