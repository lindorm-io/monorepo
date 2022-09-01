import { IErrorHandler } from "../handler";

export interface IErrorDomain {
  registerErrorHandler(errorHandler: IErrorHandler): Promise<void>;
}
