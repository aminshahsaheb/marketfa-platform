import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { CsrfController } from "./auth/csrf.controller";
import { CsrfGuard } from "./auth/csrf.guard";
import { SessionAuthGuard } from "./auth/session-auth.guard";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health/health.controller";
import { HealthService } from "./health/health.service";
import { IndustryCatalogController } from "./tenancy/industry-catalog.controller";
import { IndustryCatalogService } from "./tenancy/industry-catalog.service";
import { TenantBootstrapController } from "./tenancy/tenant-bootstrap.controller";
import { TenantBootstrapService } from "./tenancy/tenant-bootstrap.service";
import {
  InvitationAcceptanceController,
  TenantInvitationController,
} from "./tenancy/invitation.controller";
import { InvitationService } from "./tenancy/invitation.service";
import { MembershipController } from "./tenancy/membership.controller";
import { MembershipService } from "./tenancy/membership.service";
import { TerminalController } from "./tenancy/terminal.controller";
import { TerminalService } from "./tenancy/terminal.service";

@Module({
  imports: [DatabaseModule],
  controllers: [
    HealthController,
    CsrfController,
    IndustryCatalogController,
    TenantBootstrapController,
    TenantInvitationController,
    InvitationAcceptanceController,
    MembershipController,
    TerminalController,
  ],
  providers: [
    HealthService,
    IndustryCatalogService,
    TenantBootstrapService,
    InvitationService,
    MembershipService,
    TerminalService,
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule {}
