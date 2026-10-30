import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.enableShutdownHooks();
  app.setGlobalPrefix("api/v1");
  const port = Number.parseInt(process.env.API_PORT ?? "3000", 10);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
