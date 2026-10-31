import { Controller, Get, Res } from "@nestjs/common";
import type { Response } from "express";
import { Public } from "./auth.decorators";
import { buildCsrfCookie, createCsrfToken } from "./cookie-policy";

const CSRF_COOKIE_TTL_MS = 24 * 60 * 60 * 1000;

@Controller("auth")
export class CsrfController {
  @Public()
  @Get("csrf")
  csrf(@Res({ passthrough: true }) response: Response): { status: "ok" } {
    const token = createCsrfToken();
    const expiresAt = new Date(Date.now() + CSRF_COOKIE_TTL_MS).toISOString();
    response.setHeader("Set-Cookie", buildCsrfCookie(token, expiresAt));
    response.setHeader("Cache-Control", "no-store");
    return { status: "ok" };
  }
}
