import { buildDataSource } from "../config/data-source";
import { logger } from "../config/logger";

async function run() {
  const dataSource = buildDataSource();
  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.destroy();
  logger.info("Database migrations completed.");
}

void run().catch((error) => {
  logger.error({ err: error }, "Failed to run migrations.");
  process.exit(1);
});
