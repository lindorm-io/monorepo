import { ILogger } from "@lindorm/logger";
import { ClassLike, Constructor, Dict } from "@lindorm/types";
import { DomainError } from "../../errors";
import { IHermesMessage } from "../../interfaces";
import { HandlerIdentifier } from "../identifiers";

export type AggregateErrorCtx<E extends DomainError> = {
  command: ClassLike;
  error: E;
  logger: ILogger;
  message: IHermesMessage;
  dispatch(command: ClassLike, options?: AggregateErrorDispatchOptions): Promise<void>;
};

export type AggregateErrorDispatchOptions = {
  id?: string;
  delay?: number;
  mandatory?: boolean;
  meta?: Dict;
};

export type AggregateErrorHandlerOptions<C extends Constructor<DomainError>> = {
  aggregate: HandlerIdentifier;
  error: string;
  key: string;
  handler(ctx: AggregateErrorCtx<InstanceType<C>>): Promise<void>;
};
