import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Inject,
  Param,
  Post,
} from "@nestjs/common";
import { CurrentActor } from "../auth/auth.decorators";
import type { RequestActor } from "../auth/auth.types";
import { InvitationService } from "./invitation.service";
import type {
  CreateInvitationInput,
  InviteableRole,
} from "./invitation.service";

const inviteableRoles = new Set<InviteableRole>([
  "MANAGER",
  "CASHIER",
  "ACCOUNTANT",
  "VIEWER",
]);

function parseCreateInput(value: unknown): CreateInvitationInput {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("A JSON object is required.");
  }
  const body = value as Record<string, unknown>;
  if (typeof body.intendedIdentifier !== "string") {
    throw new BadRequestException("intendedIdentifier must be a string.");
  }
  const intendedIdentifier = body.intendedIdentifier.trim();
  if (intendedIdentifier.length < 3 || intendedIdentifier.length > 320) {
    throw new BadRequestException("intendedIdentifier has an invalid length.");
  }
  if (
    typeof body.role !== "string" ||
    !inviteableRoles.has(body.role as InviteableRole)
  ) {
    throw new BadRequestException("role is not inviteable.");
  }
  const ttlSeconds = body.ttlSeconds;
  if (
    ttlSeconds !== undefined &&
    (typeof ttlSeconds !== "number" || !Number.isInteger(ttlSeconds))
  ) {
    throw new BadRequestException("ttlSeconds must be an integer.");
  }
  return {
    intendedIdentifier,
    role: body.role as InviteableRole,
    ...(ttlSeconds === undefined ? {} : { ttlSeconds }),
  };
}

function parseToken(value: unknown): string {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof (value as Record<string, unknown>).token !== "string"
  ) {
    throw new BadRequestException("A valid invitation token is required.");
  }
  const token = (value as Record<string, unknown>).token;
  if (typeof token !== "string") {
    throw new BadRequestException("A valid invitation token is required.");
  }
  return token;
}

@Controller("tenants/:tenantId/invitations")
export class TenantInvitationController {
  constructor(
    @Inject(InvitationService)
    private readonly invitations: InvitationService,
  ) {}

  @Post()
  create(
    @CurrentActor() actor: RequestActor,
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
  ) {
    return this.invitations.create(actor, tenantId, parseCreateInput(body));
  }

  @Delete(":invitationId")
  revoke(
    @CurrentActor() actor: RequestActor,
    @Param("tenantId") tenantId: string,
    @Param("invitationId") invitationId: string,
  ) {
    return this.invitations.revoke(actor, tenantId, invitationId);
  }
}

@Controller("invitations")
export class InvitationAcceptanceController {
  constructor(
    @Inject(InvitationService)
    private readonly invitations: InvitationService,
  ) {}

  @Post("accept")
  accept(@CurrentActor() actor: RequestActor, @Body() body: unknown) {
    return this.invitations.accept(actor, parseToken(body));
  }
}
