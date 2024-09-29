import { IHermesErrorHandler } from "./ErrorHandler";

export interface IErrorDomain {
  registerErrorHandler(errorHandler: IHermesErrorHandler): Promise<void>;
}
