import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { CsrfController } from "./auth/csrf.controller";
import { CsrfGuard } from "./auth/csrf.guard";
import { SessionAuthGuard } from "./auth/session-auth.guard";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health/health.controller";
import { HealthService } from "./health/health.service";
import { TenantBootstrapController } from "./tenancy/tenant-bootstrap.controller";
import { TenantBootstrapService } from "./tenancy/tenant-bootstrap.service";
import {
  InvitationAcceptanceController,
  TenantInvitationController,
} from "./tenancy/invitation.controller";
import { InvitationService } from "./tenancy/invitation.service";

@Module({
  imports: [DatabaseModule],
  controllers: [
    HealthController,
    CsrfController,
    TenantBootstrapController,
    TenantInvitationController,
    InvitationAcceptanceController,
  ],
  providers: [
    HealthService,
    TenantBootstrapService,\n    InvitationService,
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule {}
