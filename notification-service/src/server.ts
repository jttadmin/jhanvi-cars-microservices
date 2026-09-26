import express from "express";
import "dotenv/config";

import notificationRoutes
  from "./routes/notificationRoutes";

import db from "./database";

import {
  errorHandler
} from "./middlewares/errorHandler";

const app = express();

const port =
  Number(process.env.PORT ?? 3007);

app.use(express.json());
app.use(notificationRoutes);
app.use(errorHandler);

async function start() {
  await db.raw("select 1");

  app.listen(port, () => {
    console.log(
      `notification-service listening on port ${port}`
    );
  });
}

start().catch((error) => {
  console.error(
    "Failed to start notification-service",
    error
  );

  process.exit(1);
});
