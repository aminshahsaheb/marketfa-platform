import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
} from "@nestjs/common";
import { CurrentActor } from "../auth/auth.decorators";
import type { RequestActor } from "../auth/auth.types";
import { TenantBootstrapService } from "./tenant-bootstrap.service";
import type { TenantBootstrapInput } from "./tenant-bootstrap.service";

function readText(
  body: Record<string, unknown>,
  field: string,
  maxLength: number,
  required: boolean,
): string | null {
  const value = body[field];
  if (value === undefined || value === null) {
    if (required) {
      throw new BadRequestException(`${field} is required.`);
    }
    return null;
  }
  if (typeof value !== "string") {
    throw new BadRequestException(`${field} must be a string.`);
  }

  const normalized = value.trim();
  if ((required && normalized.length === 0) || normalized.length > maxLength) {
    throw new BadRequestException(`${field} has an invalid length.`);
  }
  return normalized || null;
}

function parseInput(value: unknown): TenantBootstrapInput {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("A JSON object is required.");
  }

  const body = value as Record<string, unknown>;
  const displayName = readText(body, "displayName", 160, true);
  const legalName = readText(body, "legalName", 200, false);
  const locationName = readText(body, "locationName", 160, false);
  const storeName = readText(body, "storeName", 160, false);
  const industryId = readText(body, "industryId", 80, false) ?? "general-retail";

  if (!locationName && !storeName) {
    throw new BadRequestException(
      "locationName is required when storeName is not provided.",
    );
  }

  return {
    displayName: displayName!,
    legalName,
    locationName: locationName ?? storeName!,
    storeName,
    industryId: industryId!,
  };
}

@Controller("tenants")
export class TenantBootstrapController {
  constructor(
    @Inject(TenantBootstrapService)
    private readonly tenants: TenantBootstrapService,
  ) {}

  @Post()
  create(@CurrentActor() actor: RequestActor, @Body() body: unknown) {
    return this.tenants.create(actor, parseInput(body));
  }
}
