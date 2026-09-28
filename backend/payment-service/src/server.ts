import express from "express";
import "dotenv/config";
import paymentRoutes from "./routes/paymentRoutes";
import db from "./database";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();
const port = Number(process.env.PORT ?? 3006);

app.use(express.json());
app.use(paymentRoutes);
app.use(errorHandler);

async function start() {
  await db.raw("select 1");

  app.listen(port, () => {
    console.log(`payment-service listening on port ${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start payment-service", error);
  process.exit(1);
});
