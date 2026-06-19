import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("");
  // CORS limited to the Vercel/dashboard domain (Section 16.1 verify step).
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(",") ?? true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`GroundGame API listening on :${port}`);
}
bootstrap();
