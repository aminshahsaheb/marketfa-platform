import {
  createParamDecorator,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { IS_PUBLIC_KEY } from "./auth.constants";
import type { RequestActor } from "./auth.types";

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestActor => {
    const actor = context.switchToHttp().getRequest<RequestActorRequest>().auth;
    if (!actor) {
      throw new UnauthorizedException();
    }
    return actor;
  },
);

interface RequestActorRequest {
  auth?: RequestActor;
}
