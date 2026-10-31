import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Inject,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { CurrentActor } from "../auth/auth.decorators";
import type { RequestActor } from "../auth/auth.types";
import { MembershipService } from "./membership.service";
import type { ChangeableMembershipRole } from "./membership.service";

const changeableRoles = new Set<ChangeableMembershipRole>([
  "MANAGER",
  "CASHIER",
  "ACCOUNTANT",
  "VIEWER",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readUuid(value: string, field: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new BadRequestException(`${field} must be a UUID.`);
  }
  return value;
}

function parseRole(value: unknown): ChangeableMembershipRole {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof (value as Record<string, unknown>).role !== "string"
  ) {
    throw new BadRequestException("A membership role is required.");
  }
  const role = (value as Record<string, unknown>).role;
  if (typeof role !== "string" || !changeableRoles.has(role as ChangeableMembershipRole)) {
    throw new BadRequestException("This membership role cannot be assigned.");
  }
  return role as ChangeableMembershipRole;
}

@Controller("tenants/:tenantId/memberships")
export class MembershipController {
  constructor(
    @Inject(MembershipService)
    private readonly memberships: MembershipService,
  ) {}

  @Patch(":membershipId/role")
  changeRole(
    @CurrentActor() actor: RequestActor,
    @Param("tenantId") tenantId: string,
    @Param("membershipId") membershipId: string,
    @Body() body: unknown,
  ) {
    return this.memberships.changeRole(
      actor,
      readUuid(tenantId, "tenantId"),
      readUuid(membershipId, "membershipId"),
      parseRole(body),
    );
  }

  @Post(":membershipId/suspend")
  suspend(
    @CurrentActor() actor: RequestActor,
    @Param("tenantId") tenantId: string,
    @Param("membershipId") membershipId: string,
  ) {
    return this.memberships.suspend(
      actor,
      readUuid(tenantId, "tenantId"),
      readUuid(membershipId, "membershipId"),
    );
  }

  @Delete(":membershipId")
  remove(
    @CurrentActor() actor: RequestActor,
    @Param("tenantId") tenantId: string,
    @Param("membershipId") membershipId: string,
  ) {
    return this.memberships.remove(
      actor,
      readUuid(tenantId, "tenantId"),
      readUuid(membershipId, "membershipId"),
    );
  }
}
