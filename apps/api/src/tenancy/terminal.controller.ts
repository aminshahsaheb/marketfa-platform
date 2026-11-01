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
import { TerminalService } from "./terminal.service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readUuid(value: string, field: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new BadRequestException(`${field} must be a UUID.`);
  }
  return value;
}

function parseName(value: unknown): string {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof (value as Record<string, unknown>).name !== "string"
  ) {
    throw new BadRequestException("A terminal name is required.");
  }
  const name = (value as Record<string, unknown>).name as string;
  const normalized = name.trim();
  if (normalized.length < 1 || normalized.length > 120) {
    throw new BadRequestException("Terminal name has an invalid length.");
  }
  return normalized;
}

@Controller("tenants/:tenantId")
export class TerminalController {
  constructor(
    @Inject(TerminalService)
    private readonly terminals: TerminalService,
  ) {}

  @Post("stores/:storeId/terminals")
  register(
    @CurrentActor() actor: RequestActor,
    @Param("tenantId") tenantId: string,
    @Param("storeId") storeId: string,
    @Body() body: unknown,
  ) {
    return this.terminals.register(
      actor,
      readUuid(tenantId, "tenantId"),
      readUuid(storeId, "storeId"),
      parseName(body),
    );
  }

  @Post("terminals/:terminalId/credential")
  rotateCredential(
    @CurrentActor() actor: RequestActor,
    @Param("tenantId") tenantId: string,
    @Param("terminalId") terminalId: string,
  ) {
    return this.terminals.rotateCredential(
      actor,
      readUuid(tenantId, "tenantId"),
      readUuid(terminalId, "terminalId"),
    );
  }

  @Post("terminals/:terminalId/suspend")
  suspend(
    @CurrentActor() actor: RequestActor,
    @Param("tenantId") tenantId: string,
    @Param("terminalId") terminalId: string,
  ) {
    return this.terminals.suspend(
      actor,
      readUuid(tenantId, "tenantId"),
      readUuid(terminalId, "terminalId"),
    );
  }

  @Post("terminals/:terminalId/activate")
  activate(
    @CurrentActor() actor: RequestActor,
    @Param("tenantId") tenantId: string,
    @Param("terminalId") terminalId: string,
  ) {
    return this.terminals.activate(
      actor,
      readUuid(tenantId, "tenantId"),
      readUuid(terminalId, "terminalId"),
    );
  }

  @Delete("terminals/:terminalId")
  revoke(
    @CurrentActor() actor: RequestActor,
    @Param("tenantId") tenantId: string,
    @Param("terminalId") terminalId: string,
  ) {
    return this.terminals.revoke(
      actor,
      readUuid(tenantId, "tenantId"),
      readUuid(terminalId, "terminalId"),
    );
  }
}
