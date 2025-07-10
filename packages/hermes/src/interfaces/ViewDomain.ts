import { ClassLike, Dict } from "@lindorm/types";
import { ViewIdentifier, ViewStoreSource } from "../types";
import { EventEmitterListener } from "../types/event-emitter";
import { IViewModel } from "./ViewModel";

export interface IViewDomain {
  on<D extends Dict = Dict>(evt: string, listener: EventEmitterListener<D>): void;
  registerHandlers(): Promise<void>;
  inspect<S extends Dict = Dict>(
    viewIdentifier: ViewIdentifier,
    source: ViewStoreSource,
  ): Promise<IViewModel<S>>;
  query<R>(query: ClassLike): Promise<R>;
}
