import { Dict } from "@lindorm/types";
import { StandardIdentifier } from "./identifiers";

export type EventEmitterSagaData<S extends Dict = Dict> = StandardIdentifier & {
  destroyed: boolean;
  state: S;
};

export type EventEmitterViewData<S extends Dict = Dict> = StandardIdentifier & {
  destroyed: boolean;
  revision: number;
  state: S;
};

export type EventEmitterListener<D extends Dict = Dict> = (data: D) => void;
