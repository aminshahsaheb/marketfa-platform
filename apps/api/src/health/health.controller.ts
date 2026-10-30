import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { HealthService } from "./health.service";
@Controller("health")
export class HealthController {
 constructor(private readonly healthService: HealthService) {}
 @Get("live") live(): { status: "ok" } { return { status: "ok" }; }
 @Get("ready") async ready(): Promise<{ status: "ready"; database: "ok" }> {
  if (!(await this.healthService.isDatabaseReady())) throw new ServiceUnavailableException({ status: "not_ready", database: "unavailable" });
  return { status: "ready", database: "ok" };
 }
}
