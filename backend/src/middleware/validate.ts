import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { AppError } from "../errors/app-error";

type SchemaLike = ZodType;

export function validateBody(schema: SchemaLike) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      return next(
        new AppError(400, "VALIDATION_ERROR", "Request body validation failed.", result.error.flatten()),
      );
    }

    request.body = result.data;
    return next();
  };
}
