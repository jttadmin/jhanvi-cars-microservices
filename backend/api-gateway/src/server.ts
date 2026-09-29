import express from "express";
import dotenv from "dotenv";
import { createProxyMiddleware } from "http-proxy-middleware";
import { randomUUID } from "crypto";

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 3000);

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL!;
const USER_SERVICE_URL = process.env.USER_SERVICE_URL!;
const DRIVER_SERVICE_URL = process.env.DRIVER_SERVICE_URL!;
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL!;
const VEHICLE_SERVICE_URL = process.env.VEHICLE_SERVICE_URL!;
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL!;
const NOTIFICATION_SERVICE_URL =
  process.env.NOTIFICATION_SERVICE_URL!;

const PROXY_TIMEOUT_MS = Number(
  process.env.PROXY_TIMEOUT_MS || "5000"
);

app.use(express.json());
app.use((req, res, next) => {
  const requestId = req.header("x-request-id") || randomUUID();

  req.headers["x-request-id"] = requestId;
  res.setHeader("x-request-id", requestId);

  next();
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    service: "api-gateway",
    status: "UP",
  });
});

// Auth Service
// Gateway: /auth/login
// Service: /login
app.use(
  createProxyMiddleware({
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
    pathFilter: "/auth",
    pathRewrite: {
      "^/auth": "",
    },
    proxyTimeout: PROXY_TIMEOUT_MS,
    timeout: PROXY_TIMEOUT_MS,
  })
);

// User Service
// Gateway: /users/me
// Service: /users/me
app.use(
  createProxyMiddleware({
    target: USER_SERVICE_URL,
    changeOrigin: true,
    pathFilter: "/users",
    proxyTimeout: PROXY_TIMEOUT_MS,
    timeout: PROXY_TIMEOUT_MS,
  })
);

// Driver Service
// Gateway: /drivers/...
// Service: /drivers/...
app.use(
  createProxyMiddleware({
    target: DRIVER_SERVICE_URL,
    changeOrigin: true,
    pathFilter: "/drivers",
    proxyTimeout: PROXY_TIMEOUT_MS,
    timeout: PROXY_TIMEOUT_MS,
  })
);

// Booking Service
// Gateway: /bookings/...
// Service: /bookings/...
app.use(
  createProxyMiddleware({
    target: BOOKING_SERVICE_URL,
    changeOrigin: true,
    pathFilter: "/bookings",
    proxyTimeout: PROXY_TIMEOUT_MS,
    timeout: PROXY_TIMEOUT_MS,
  })
);

// Vehicle Service
// Gateway: /vehicles/...
// Service: /vehicles/...
app.use(
  createProxyMiddleware({
    target: VEHICLE_SERVICE_URL,
    changeOrigin: true,
    pathFilter: "/vehicles",
    proxyTimeout: PROXY_TIMEOUT_MS,
    timeout: PROXY_TIMEOUT_MS,
  })
);

// Payment Service
// Gateway: /payments/...
// Service: /payments/...
app.use(
  createProxyMiddleware({
    target: PAYMENT_SERVICE_URL,
    changeOrigin: true,
    pathFilter: "/payments",
    proxyTimeout: PROXY_TIMEOUT_MS,
    timeout: PROXY_TIMEOUT_MS,
  })
);

// Notification Service
// Gateway: /notifications/...
// Service: /notifications/...
app.use(
  createProxyMiddleware({
    target: NOTIFICATION_SERVICE_URL,
    changeOrigin: true,
    pathFilter: "/notifications",
    proxyTimeout: PROXY_TIMEOUT_MS,
    timeout: PROXY_TIMEOUT_MS,
  })
);

// Gateway route not found
app.use((_req, res) => {
  res.status(404).json({
    message: "API Gateway route not found",
  });
});

// Gateway error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("API Gateway error:", err);

    res.status(502).json({
      message: "Bad Gateway",
    });
  }
);

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log(`Proxy timeout: ${PROXY_TIMEOUT_MS}ms`);
});
