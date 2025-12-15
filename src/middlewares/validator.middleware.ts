import { validationResult, ValidationError } from "express-validator";
import { Request, Response, NextFunction } from "express";
import { ApiError } from "src/utils/api-error";

export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const validationErrors = validationResult(req);
  
  if (validationErrors.isEmpty()) {
    return next();
  }
  
  const formattedErrors = formatValidationErrors(validationErrors.array());
  throw new ApiError(400, "Validation failed", formattedErrors);
};

const formatValidationErrors = (errors: ValidationError[]): string[] => {
  return errors.map(error => {
    if (error.type === "field") {
      return `${error.path}: ${error.msg}`;
    }
    return error.msg;
  });
};