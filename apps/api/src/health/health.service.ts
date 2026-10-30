import { Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class HealthService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService
  ) {}

  async isDatabaseReady(): Promise<boolean> {
    return this.database.isReady();
  }
}
