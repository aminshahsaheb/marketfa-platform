import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SessionService } from "../sessions/session.service";
import { IS_PUBLIC_KEY, SESSION_COOKIE_NAME } from "./auth.constants";
import type { RequestActor } from "./auth.types";

interface AuthenticatedRequest {
  headers: { cookie?: string };
  auth?: RequestActor;
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
    const key = segment.slice(0, separator).trim();
    if (key !== name) {
      continue;
    }
    if (found !== null) {
      return null;
    }
    found = segment.slice(separator + 1).trim();
  }
  return found;
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readCookie(request.headers.cookie, SESSION_COOKIE_NAME);
    if (!token) {
      throw new UnauthorizedException();
    }

    const session = await this.sessions.resolve(token);
    if (!session) {
      throw new UnauthorizedException();
    }

    request.auth = {
      userId: session.userId,
      sessionId: session.sessionId,
    };
    return true;
  }
}
