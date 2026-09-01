"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoricalPaperController = void 0;
class HistoricalPaperController {
    historicalPaperService;
    constructor(historicalPaperService) {
        this.historicalPaperService = historicalPaperService;
    }
    import = async (request, response) => {
        const result = await this.historicalPaperService.importStructuredPapers(request.body);
        response.status(201).json(result);
    };
    status = async (_request, response) => {
        const result = await this.historicalPaperService.getStatus();
        response.json(result);
    };
}
exports.HistoricalPaperController = HistoricalPaperController;
//# sourceMappingURL=historical-paper.controller.js.map