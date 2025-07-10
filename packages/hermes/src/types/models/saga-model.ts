import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import { IHermesMessage, IHermesMessageBus, IHermesRegistry } from "../../interfaces";
import { HermesCommand, HermesTimeout } from "../../messages";
import { SagaIdentifier } from "../identifiers";

export interface SagaData<S extends Dict = Dict> extends SagaIdentifier {
  destroyed: boolean;
  messagesToDispatch: Array<IHermesMessage>;
  processedCausationIds: Array<string>;
  revision: number;
  state: S;
}

export interface SagaModelOptions<S extends Dict = Dict> extends SagaIdentifier {
  destroyed?: boolean;
  messagesToDispatch?: Array<IHermesMessage>;
  processedCausationIds?: Array<string>;
  revision?: number;
  state?: S;

  commandBus: IHermesMessageBus<HermesCommand<Dict>>;
  logger: ILogger;
  registry: IHermesRegistry;
  timeoutBus: IHermesMessageBus<HermesTimeout>;
}

export interface SagaDispatchOptions {
  id?: string;
  delay?: number;
  mandatory?: boolean;
  meta?: Dict;
}
