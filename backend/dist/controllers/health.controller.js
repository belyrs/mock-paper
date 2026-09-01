"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
class HealthController {
    dataSource;
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    health = async (_request, response) => {
        const result = await this.dataSource.query("SELECT 1 as ok");
        response.json({
            status: "ok",
            database: result?.[0]?.ok === 1 ? "ok" : "unknown",
            timestamp: new Date().toISOString(),
        });
    };
}
exports.HealthController = HealthController;
//# sourceMappingURL=health.controller.js.map