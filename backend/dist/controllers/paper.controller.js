"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaperController = void 0;
const serializers_1 = require("../utils/serializers");
class PaperController {
    paperService;
    constructor(paperService) {
        this.paperService = paperService;
    }
    list = async (request, response) => {
        const papers = await this.paperService.listPapers(request.auth.userId);
        response.json({ papers: papers.map(serializers_1.serializePaper) });
    };
    generate = async (request, response) => {
        const paper = await this.paperService.generatePaper(request.auth.userId, request.body);
        response.status(201).json({ paper: (0, serializers_1.serializePaper)(paper) });
    };
    getOne = async (request, response) => {
        const paper = await this.paperService.getPaper(request.auth.userId, String(request.params.paperId));
        response.json({ paper: (0, serializers_1.serializePaper)(paper) });
    };
    rename = async (request, response) => {
        const paper = await this.paperService.renamePaper(request.auth.userId, String(request.params.paperId), request.body);
        response.json({ paper: (0, serializers_1.serializePaper)(paper) });
    };
    delete = async (request, response) => {
        await this.paperService.deletePaper(request.auth.userId, String(request.params.paperId));
        response.status(204).send();
    };
    regeneratePaper = async (request, response) => {
        const paper = await this.paperService.regeneratePaper(request.auth.userId, String(request.params.paperId));
        response.status(201).json({ paper: (0, serializers_1.serializePaper)(paper) });
    };
    updateQuestion = async (request, response) => {
        const paper = await this.paperService.updateQuestion(request.auth.userId, String(request.params.paperId), String(request.params.questionId), request.body);
        response.json({ paper: (0, serializers_1.serializePaper)(paper) });
    };
    regenerateQuestion = async (request, response) => {
        const paper = await this.paperService.regenerateQuestion(request.auth.userId, String(request.params.paperId), String(request.params.questionId));
        response.json({ paper: (0, serializers_1.serializePaper)(paper) });
    };
}
exports.PaperController = PaperController;
//# sourceMappingURL=paper.controller.js.map