import { DeepPartial, Dict } from "@lindorm/types";
import { ViewData } from "../types";
import { IHermesMessage } from "./HermesMessage";

export interface IViewModel<S extends Dict = Dict> extends ViewData<S> {
  destroy(event: IHermesMessage): void;
  mergeState(event: IHermesMessage, data: DeepPartial<S>): void;
  setState(event: IHermesMessage, data: DeepPartial<S>): void;
  toJSON(): ViewData;
}
