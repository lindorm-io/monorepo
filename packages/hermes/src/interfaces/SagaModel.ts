import { ClassLike, Dict } from "@lindorm/types";
import { SagaData, SagaDispatchOptions } from "../types";
import { IHermesMessage } from "./HermesMessage";

export interface ISagaModel<S extends Dict = Dict> extends SagaData<S> {
  destroy(): void;
  dispatch(
    causation: IHermesMessage,
    command: ClassLike,
    options?: SagaDispatchOptions,
  ): void;
  mergeState(data: Dict): void;
  setState(data: Dict): void;
  timeout(causation: IHermesMessage, name: string, data: Dict, delay: number): void;
  toJSON(): SagaData;
}
