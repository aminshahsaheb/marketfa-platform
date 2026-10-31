import { Module } from "@nestjs/common";
import { Pool } from "pg";
import { DATABASE_POOL, DatabaseService } from "./database.service";
import {
  AUTH_DATABASE_POOL,
  SessionService,
} from "../sessions/session.service";

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
    {
      provide: AUTH_DATABASE_POOL,
      useFactory: () => {
        const connectionString = process.env.AUTH_DATABASE_URL;
        if (!connectionString) {
          throw new Error("AUTH_DATABASE_URL is required.");
        }
        return new Pool({ connectionString, max: 2 });
      },
    },
    DatabaseService,
    SessionService,
  ],
  exports: [DATABASE_POOL, AUTH_DATABASE_POOL, DatabaseService, SessionService],
})
export class DatabaseModule {}
