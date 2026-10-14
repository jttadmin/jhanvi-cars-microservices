import express from "express";
import "dotenv/config";
import notificationRoutes from "./routes/notificationRoutes";
import db from "./database";
import { errorHandler } from "./middlewares/errorHandler";
import { notificationService } from "./services/notificationService";

const app = express();
const port = Number(process.env.PORT ?? 3007);
const RETRY_INTERVAL_MS = 30_000;
let retryWorkerRunning = false;

app.use(express.json());
app.use(notificationRoutes);
app.use(errorHandler);

async function runRetryWorker() {
  if (retryWorkerRunning) return;
  retryWorkerRunning = true;
  try {
    await notificationService.retryDue();
  } catch (error) {
    console.error("Notification retry worker failed", error instanceof Error ? error.message : "Unknown error");
  } finally {
    retryWorkerRunning = false;
  }
}

async function start() {
  await db.raw("select 1");
  app.listen(port, () => {
    console.log(`notification-service listening on port ${port}`);
    setInterval(() => void runRetryWorker(), RETRY_INTERVAL_MS);
    void runRetryWorker();
  });
}

start().catch((error) => {
  console.error("Failed to start notification-service", error);
  process.exit(1);
});
