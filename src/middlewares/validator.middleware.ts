import { validationResult, ValidationError } from "express-validator";
import { Request, Response, NextFunction } from "express";
import { ApiError } from "src/utils/api-error";

export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array() 
    });
  }
  
  next();
};
