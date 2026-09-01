import type { Request, Response } from "express";
import type { DataSource } from "typeorm";

export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  health = async (_request: Request, response: Response) => {
    const result = await this.dataSource.query("SELECT 1 as ok");
    response.json({
      status: "ok",
      database: result?.[0]?.ok === 1 ? "ok" : "unknown",
      timestamp: new Date().toISOString(),
    });
  };
}
