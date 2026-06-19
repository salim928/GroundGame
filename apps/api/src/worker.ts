import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { AppModule } from "./app.module";
import { SyncService } from "./sync/sync.service";

/**
 * BullMQ sync worker (Section 4 / 17 Phase 2). Runs the full pull + reconcile every
 * SYNC_INTERVAL_MINUTES (default 15) and processes manual /sync/run jobs.
 */
async function bootstrap() {
  const logger = new Logger("SyncWorker");
  const app = await NestFactory.createApplicationContext(AppModule);
  const sync = app.get(SyncService);

  // Cast: bullmq bundles its own ioredis copy, so the instance types are nominally distinct.
  const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  }) as unknown as any;
  const queue = new Queue("sync", { connection });
  const intervalMin = Number(process.env.SYNC_INTERVAL_MINUTES ?? 15);

  // Repeatable job — staggered batches handled inside runAll (Section 8.3).
  await queue.add(
    "full-pull",
    {},
    { repeat: { every: intervalMin * 60 * 1000 }, removeOnComplete: true, removeOnFail: 100 },
  );

  new Worker(
    "sync",
    async (job) => {
      logger.log(`Running sync job ${job.name}`);
      const res = await sync.runAll();
      logger.log(`Sync done: ${res.constituencies} constituencies, ${res.conflicts} conflicts`);
      return res;
    },
    { connection, concurrency: 1 },
  );

  logger.log(`Sync worker started — every ${intervalMin} min`);
}

bootstrap();
