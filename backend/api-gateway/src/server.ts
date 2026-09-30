import express from "express";
import dotenv from "dotenv";
import { createProxyMiddleware } from "http-proxy-middleware";
import { randomUUID } from "crypto";

import { LocalJwtTokenVerifier } from "./auth/tokenVerifier";
import { createAuthMiddleware } from "./auth/authMiddleware";
import { requireRoles } from "./authorization/roleMiddleware";

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

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
throw new Error("Missing required configuration: JWT_SECRET");
}

const tokenVerifier = new LocalJwtTokenVerifier(JWT_SECRET);
const authMiddleware = createAuthMiddleware(tokenVerifier);

const INTERNAL_SERVICE_TOKEN =
  process.env.INTERNAL_SERVICE_TOKEN;

if (!INTERNAL_SERVICE_TOKEN) {
  throw new Error(
    "Missing required configuration: INTERNAL_SERVICE_TOKEN"
  );
}

function injectInternalServiceToken(proxyReq: any) {
  proxyReq.setHeader(
    "x-internal-service-token",
    INTERNAL_SERVICE_TOKEN
  );
}

/*

* Request ID
  */
  app.use((req, res, next) => {
  const requestId =
  req.header("x-request-id") || randomUUID();

req.headers["x-request-id"] = requestId;
res.setHeader("x-request-id", requestId);

next();
});

/*

* Gateway health
  */
  app.get("/health", (_req, res) => {
  res.status(200).json({
  service: "api-gateway",
  status: "UP",
  });
  });

/*

* ============================================================
* AUTH SERVICE
* ============================================================
*
* Public:
* POST /auth/login
* POST /auth/register
* GET  /auth/health
*
* Protected:
* GET /auth/me
* PUT /auth/me
  */
  app.use("/auth/me", authMiddleware);

app.use(
createProxyMiddleware({
target: AUTH_SERVICE_URL,
changeOrigin: true,
pathFilter: "/auth",
proxyTimeout: PROXY_TIMEOUT_MS,
timeout: PROXY_TIMEOUT_MS,
})
);

/*

* ============================================================
* USER SERVICE
* ============================================================
*
* Protected:
* /users/*
  */
  app.use(
  "/users",
  authMiddleware
  );

app.use(
createProxyMiddleware({
target: USER_SERVICE_URL,
changeOrigin: true,
pathFilter: "/users",
proxyTimeout: PROXY_TIMEOUT_MS,
timeout: PROXY_TIMEOUT_MS,
})
);

/*

* ============================================================
* DRIVER SERVICE
* ============================================================
*
* CUSTOMER -> denied
* DRIVER   -> allowed
* ADMIN    -> allowed
  */
  app.use(
  "/drivers",
  authMiddleware,
  requireRoles("DRIVER", "ADMIN")
  );

app.use(
createProxyMiddleware({
target: DRIVER_SERVICE_URL,
changeOrigin: true,
pathFilter: "/drivers",
proxyTimeout: PROXY_TIMEOUT_MS,
timeout: PROXY_TIMEOUT_MS,
on: {
  proxyReq: injectInternalServiceToken,
},
})
);

/*

* ============================================================
* BOOKING SERVICE
* ============================================================
*
* CUSTOMER -> allowed
* DRIVER   -> allowed
* ADMIN    -> allowed
  */
  app.use(
  "/bookings",
  authMiddleware,
  requireRoles(
  "CUSTOMER",
  "DRIVER",
  "ADMIN"
  )
  );

app.use(
createProxyMiddleware({
target: BOOKING_SERVICE_URL,
changeOrigin: true,
pathFilter: "/bookings",
proxyTimeout: PROXY_TIMEOUT_MS,
timeout: PROXY_TIMEOUT_MS,
})
);

/*

* ============================================================
* VEHICLE SERVICE
* ============================================================
*
* Public vehicle catalog for now.
  */
  app.use(
  createProxyMiddleware({
  target: VEHICLE_SERVICE_URL,
  changeOrigin: true,
  pathFilter: "/vehicles",
  proxyTimeout: PROXY_TIMEOUT_MS,
  timeout: PROXY_TIMEOUT_MS,
  on: {
    proxyReq: injectInternalServiceToken,
  },
  })
  );

/*

* ============================================================
* PAYMENT SERVICE
* ============================================================
*
* Public API:
* CUSTOMER -> allowed
* ADMIN    -> allowed
*
* Internal-only:
* PATCH /payments/:id/status
*
* The internal-only endpoint is blocked BEFORE the
* general payment proxy.
  */
  app.patch(
  "/payments/:id/status",
  (_req, res) => {
  res.status(403).json({
  message:
  "Payment status can only be changed by an internal service",
  });
  }
  );

app.use(
"/payments",
authMiddleware,
requireRoles("CUSTOMER", "ADMIN")
);

app.use(
createProxyMiddleware({
target: PAYMENT_SERVICE_URL,
changeOrigin: true,
pathFilter: "/payments",
proxyTimeout: PROXY_TIMEOUT_MS,
timeout: PROXY_TIMEOUT_MS,
})
);

/*

* ============================================================
* NOTIFICATION SERVICE
* ============================================================
*
* Public gateway API:
* GET /notifications
* GET /notifications/:id
*
* Internal-only:
* POST  /notifications
* PUT   /notifications/:id
* PATCH /notifications/:id/status
*
* Internal write operations are blocked BEFORE the
* general notification proxy.
  */
  app.post(
  "/notifications",
  (_req, res) => {
  res.status(403).json({
  message:
  "Notification creation requires an internal service",
  });
  }
  );

app.put(
"/notifications/:id",
(_req, res) => {
res.status(403).json({
message:
"Notification updates require an internal service",
});
}
);

app.patch(
"/notifications/:id/status",
(_req, res) => {
res.status(403).json({
message:
"Notification status changes require an internal service",
});
}
);

/*

* Notification reads require authentication.
  */
  app.use(
  "/notifications",
  authMiddleware
  );

app.use(
createProxyMiddleware({
target: NOTIFICATION_SERVICE_URL,
changeOrigin: true,
pathFilter: "/notifications",
proxyTimeout: PROXY_TIMEOUT_MS,
timeout: PROXY_TIMEOUT_MS,
})
);

/*

* ============================================================
* GATEWAY 404
* ============================================================
  */
  app.use((_req, res) => {
  res.status(404).json({
  message: "API Gateway route not found",
  });
  });

/*

* ============================================================
* GATEWAY ERROR HANDLER
* ============================================================
  */
  app.use(
  (
  err: Error,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction
  ) => {
  console.error(
  "API Gateway error:",
  err
  );

  res.status(502).json({
  message: "Bad Gateway",
  });
  }
  );

/*

* ============================================================
* START SERVER
* ============================================================
  */
  app.listen(PORT, () => {
  console.log(
  `API Gateway running on port ${PORT}`
  );

console.log(
`Proxy timeout: ${PROXY_TIMEOUT_MS}ms`
);
});
