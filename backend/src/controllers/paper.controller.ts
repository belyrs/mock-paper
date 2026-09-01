import type { Request, Response } from "express";
import type { PaperService } from "../services/paper.service";
import { serializePaper } from "../utils/serializers";

export class PaperController {
  constructor(private readonly paperService: PaperService) {}

  list = async (request: Request, response: Response) => {
    const papers = await this.paperService.listPapers(request.auth!.userId);
    response.json({ papers: papers.map(serializePaper) });
  };

  generate = async (request: Request, response: Response) => {
    const paper = await this.paperService.generatePaper(request.auth!.userId, request.body);
    response.status(201).json({ paper: serializePaper(paper) });
  };

  getOne = async (request: Request, response: Response) => {
    const paper = await this.paperService.getPaper(
      request.auth!.userId,
      String(request.params.paperId),
    );
    response.json({ paper: serializePaper(paper) });
  };

  rename = async (request: Request, response: Response) => {
    const paper = await this.paperService.renamePaper(
      request.auth!.userId,
      String(request.params.paperId),
      request.body,
    );
    response.json({ paper: serializePaper(paper) });
  };

  delete = async (request: Request, response: Response) => {
    await this.paperService.deletePaper(request.auth!.userId, String(request.params.paperId));
    response.status(204).send();
  };

  regeneratePaper = async (request: Request, response: Response) => {
    const paper = await this.paperService.regeneratePaper(
      request.auth!.userId,
      String(request.params.paperId),
    );
    response.status(201).json({ paper: serializePaper(paper) });
  };

  updateQuestion = async (request: Request, response: Response) => {
    const paper = await this.paperService.updateQuestion(
      request.auth!.userId,
      String(request.params.paperId),
      String(request.params.questionId),
      request.body,
    );
    response.json({ paper: serializePaper(paper) });
  };

  regenerateQuestion = async (request: Request, response: Response) => {
    const paper = await this.paperService.regenerateQuestion(
      request.auth!.userId,
      String(request.params.paperId),
      String(request.params.questionId),
    );
    response.json({ paper: serializePaper(paper) });
  };
}
