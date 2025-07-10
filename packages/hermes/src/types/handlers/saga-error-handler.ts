import { ILogger } from "@lindorm/logger";
import { ClassLike, Constructor, Dict } from "@lindorm/types";
import { DomainError } from "../../errors";
import { IHermesMessage } from "../../interfaces";
import { SagaErrorCallback } from "../decorators";
import { HandlerIdentifier, SagaIdentifier } from "../identifiers";

export type SagaErrorCtx<E extends DomainError> = {
  error: E;
  event: ClassLike;
  message: IHermesMessage;
  logger: ILogger;
  saga: SagaIdentifier;
  dispatch(command: ClassLike, options?: SagaErrorDispatchOptions): Promise<void>;
};

export type SagaErrorDispatchOptions = {
  id?: string;
  delay?: number;
  mandatory?: boolean;
  meta?: Dict;
};

export type SagaErrorHandlerOptions<C extends Constructor<DomainError>> = {
  aggregate: HandlerIdentifier;
  error: string;
  key: string;
  saga: HandlerIdentifier;
  handler: SagaErrorCallback<C>;
};
