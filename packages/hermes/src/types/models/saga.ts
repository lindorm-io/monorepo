import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import { IHermesMessage } from "../../interfaces";
import { AggregateIdentifier, SagaIdentifier } from "../identifiers";

export interface SagaData<S extends Dict = Dict> extends SagaIdentifier {
  destroyed: boolean;
  hash: string;
  messagesToDispatch: Array<IHermesMessage>;
  processedCausationIds: Array<string>;
  revision: number;
  state: S;
}

export interface SagaOptions<S extends Dict = Dict> extends SagaIdentifier {
  destroyed?: boolean;
  hash?: string;
  logger: ILogger;
  messagesToDispatch?: Array<IHermesMessage>;
  processedCausationIds?: Array<string>;
  revision?: number;
  state?: S;
}

export interface SagaDispatchOptions {
  aggregate?: Partial<AggregateIdentifier>;
  delay?: number;
  mandatory?: boolean;
}
