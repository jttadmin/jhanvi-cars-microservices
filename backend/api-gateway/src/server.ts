import express from "express";
import dotenv from "dotenv";
import { createProxyMiddleware } from "http-proxy-middleware";

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 3000);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    service: "api-gateway",
    status: "UP",
  });
});

/*
 * API Gateway Routes
 *
 * Important:
 * We do NOT mount these proxies using:
 *
 * app.use("/vehicles", ...)
 *
 * because Express strips the mounted prefix before
 * the middleware receives the request.
 *
 * Instead, pathFilter keeps the original request path.
 */

app.use(
  createProxyMiddleware({
    target: "AUTH_SERVICE_URL",
    changeOrigin: true,
    pathFilter: "/auth",
    pathRewrite: {
      "^/auth": "",
    },
  })
);

app.use(
  createProxyMiddleware({
    target: "USER_SERVICE_URL",
    changeOrigin: true,
    pathFilter: "/users",
  })
);

app.use(
  createProxyMiddleware({
    target: "DRIVER_SERVICE_URL",
    changeOrigin: true,
    pathFilter: "/drivers",
  })
);

app.use(
  createProxyMiddleware({
    target: "BOOKING_SERVICE_URL",
    changeOrigin: true,
    pathFilter: "/bookings",
  })
);

app.use(
  createProxyMiddleware({
    target: "VEHICLE_SERVICE_URL",
    changeOrigin: true,
    pathFilter: "/vehicles",
  })
);

app.use(
  createProxyMiddleware({
    target: "PAYMENT_SERVICE_URL",
    changeOrigin: true,
    pathFilter: "/payments",
  })
);

app.use(
  createProxyMiddleware({
    target: "NOTIFICATION_SERVICE_URL",
    changeOrigin: true,
    pathFilter: "/notifications",
  })
);

/*
 * Gateway 404
 */
app.use((_req, res) => {
  res.status(404).json({
    message: "API Gateway route not found",
  });
});

/*
 * Gateway error handler
 */
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
});
