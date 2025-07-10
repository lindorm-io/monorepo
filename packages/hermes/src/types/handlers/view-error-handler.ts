import { ILogger } from "@lindorm/logger";
import { ClassLike, Constructor, Dict } from "@lindorm/types";
import { DomainError } from "../../errors";
import { IHermesMessage } from "../../interfaces";
import { ViewErrorCallback } from "../decorators";
import { HandlerIdentifier, ViewIdentifier } from "../identifiers";

export type ViewErrorCtx<E extends DomainError> = {
  error: E;
  event: ClassLike;
  logger: ILogger;
  message: IHermesMessage;
  view: ViewIdentifier;
  dispatch(command: ClassLike, options?: ViewErrorDispatchOptions): Promise<void>;
};

export type ViewErrorDispatchOptions = {
  id?: string;
  delay?: number;
  mandatory?: boolean;
  meta?: Dict;
};

export type ViewErrorHandlerOptions<C extends Constructor<DomainError>> = {
  aggregate: HandlerIdentifier;
  error: string;
  key: string;
  view: HandlerIdentifier;
  handler: ViewErrorCallback<C>;
};
