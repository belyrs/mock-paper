import type { Request, Response } from "express";
import type { HistoricalPaperService } from "../services/historical-paper.service";

export class HistoricalPaperController {
  constructor(private readonly historicalPaperService: HistoricalPaperService) {}

  import = async (request: Request, response: Response) => {
    const result = await this.historicalPaperService.importStructuredPapers(request.body);
    response.status(201).json(result);
  };

  status = async (_request: Request, response: Response) => {
    const result = await this.historicalPaperService.getStatus();
    response.json(result);
  };
}
