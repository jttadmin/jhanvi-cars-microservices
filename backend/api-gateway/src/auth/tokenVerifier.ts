import jwt, { JwtPayload } from "jsonwebtoken";

export type UserRole = "CUSTOMER" | "DRIVER" | "ADMIN";

export interface AuthenticatedUser {
  sub: string;
  role: UserRole;
}

export interface TokenVerifier {
  verify(token: string): AuthenticatedUser;
}

export class LocalJwtTokenVerifier implements TokenVerifier {
  constructor(private readonly jwtSecret: string) {}

  verify(token: string): AuthenticatedUser {
    const decoded = jwt.verify(token, this.jwtSecret) as JwtPayload;

    if (
      typeof decoded.sub !== "string" ||
      typeof decoded.role !== "string" ||
      !["CUSTOMER", "DRIVER", "ADMIN"].includes(decoded.role)
    ) {
      throw new Error("Invalid token payload");
    }

    return {
      sub: decoded.sub,
      role: decoded.role as UserRole,
    };
  }
}
