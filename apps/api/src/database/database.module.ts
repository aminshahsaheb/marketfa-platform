import { Module } from "@nestjs/common";
import { Pool } from "pg";
import { DATABASE_POOL, DatabaseService } from "./database.service";

@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      useFactory: () => {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
          throw new Error("DATABASE_URL is required.");
        }
        return new Pool({ connectionString, max: 10 });
      },
    },
    DatabaseService,
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}
