import { timingSafeEqual } from "node:crypto";
import { ForbiddenException, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  SAFE_HTTP_METHODS,
} from "./auth.constants";

interface CsrfRequest {
  method: string;
  headers: {
    cookie?: string;
    origin?: string;
    [key: string]: string | string[] | undefined;
  };
}

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) {
    return null;
  }

  let found: string | null = null;
  for (const segment of header.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0) {
      continue;
    }
    if (segment.slice(0, separator).trim() !== name) {
      continue;
    }
    if (found !== null) {
      return null;
    }
    found = segment.slice(separator + 1).trim();
  }
  return found;
}

function trustedOrigins(): Set<string> {
  const values = (process.env.CSRF_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const origins = new Set<string>();

  for (const value of values) {
    try {
      const parsed = new URL(value);
      if (
        (parsed.protocol === "http:" || parsed.protocol === "https:") &&
        parsed.origin === value
      ) {
        origins.add(parsed.origin);
      }
    } catch {
      // Invalid entries fail closed and are ignored.
    }
  }
  return origins;
}

function validToken(value: string | null): value is string {
  if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value)) {
    return false;
  }
  const bytes = Buffer.from(value, "base64url");
  return bytes.length === 32 && bytes.toString("base64url") === value;
}

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<CsrfRequest>();
    if (SAFE_HTTP_METHODS.has(request.method.toUpperCase())) {
      return true;
    }

    const origin = request.headers.origin;
    if (!origin || !trustedOrigins().has(origin)) {
      throw new ForbiddenException("Invalid request origin.");
    }

    const cookieToken = readCookie(request.headers.cookie, CSRF_COOKIE_NAME);
    const headerValue = request.headers[CSRF_HEADER_NAME];
    if (
      typeof headerValue !== "string" ||
      !validToken(cookieToken) ||
      !validToken(headerValue)
    ) {
      throw new ForbiddenException("Invalid CSRF token.");
    }

    const cookieBytes = Buffer.from(cookieToken, "base64url");
    const headerBytes = Buffer.from(headerValue, "base64url");
    if (!timingSafeEqual(cookieBytes, headerBytes)) {
      throw new ForbiddenException("Invalid CSRF token.");
    }
    return true;
  }
}
