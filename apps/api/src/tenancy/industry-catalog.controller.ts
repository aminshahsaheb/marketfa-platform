import { Controller, Get, Inject } from "@nestjs/common";
import { Public } from "../auth/auth.decorators";
import { IndustryCatalogService } from "./industry-catalog.service";

@Public()
@Controller("industries")
export class IndustryCatalogController {
  constructor(
    @Inject(IndustryCatalogService)
    private readonly industries: IndustryCatalogService,
  ) {}

  @Get()
  list() {
    return this.industries.list();
  }
}
