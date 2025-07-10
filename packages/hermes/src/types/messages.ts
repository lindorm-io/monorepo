import { Dict } from "@lindorm/types";
import { DomainError } from "../errors";
import { IHermesMessage } from "../interfaces";
import { AggregateIdentifier, SagaIdentifier, ViewIdentifier } from "./identifiers";

export type HermesMessageOptions<
  D extends Dict = Dict,
  M extends Dict = Dict,
> = Partial<IHermesMessage> & {
  aggregate: AggregateIdentifier;
  causationId?: string;
  correlationId?: string;
  data?: D;
  meta?: M;
  name: string;
  version?: number;
};

export type HermesErrorData = {
  error: DomainError;
  message: IHermesMessage;
  saga?: SagaIdentifier;
  view?: ViewIdentifier;
};
