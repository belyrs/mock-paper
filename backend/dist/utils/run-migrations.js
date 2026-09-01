"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const data_source_1 = require("../config/data-source");
const logger_1 = require("../config/logger");
async function run() {
    const dataSource = (0, data_source_1.buildDataSource)();
    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.destroy();
    logger_1.logger.info("Database migrations completed.");
}
void run().catch((error) => {
    logger_1.logger.error({ err: error }, "Failed to run migrations.");
    process.exit(1);
});
//# sourceMappingURL=run-migrations.js.map