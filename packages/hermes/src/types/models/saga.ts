import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import { IHermesMessage, IHermesMessageBus } from "../../interfaces";
import { HermesCommand, HermesTimeout } from "../../messages";
import { AggregateIdentifier, SagaIdentifier } from "../identifiers";

export interface SagaData<S extends Dict = Dict> extends SagaIdentifier {
  destroyed: boolean;
  messagesToDispatch: Array<IHermesMessage>;
  processedCausationIds: Array<string>;
  revision: number;
  state: S;
}

export interface SagaOptions<S extends Dict = Dict> extends SagaIdentifier {
  commandBus: IHermesMessageBus<HermesCommand>;
  destroyed?: boolean;
  logger: ILogger;
  messagesToDispatch?: Array<IHermesMessage>;
  processedCausationIds?: Array<string>;
  revision?: number;
  state?: S;
  timeoutBus: IHermesMessageBus<HermesTimeout>;
}

export interface SagaDispatchOptions {
  aggregate?: Partial<AggregateIdentifier>;
  delay?: number;
  mandatory?: boolean;
}
