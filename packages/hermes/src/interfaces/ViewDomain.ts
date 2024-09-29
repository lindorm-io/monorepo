import { Dict } from "@lindorm/types";
import { ViewEventHandlerAdapter, ViewIdentifier } from "../types";
import { EventEmitterListener } from "../types/event-emitter";
import { IView } from "./View";
import { IHermesViewEventHandler } from "./ViewEventHandler";

export interface IViewDomain {
  on<D extends Dict = Dict>(evt: string, listener: EventEmitterListener<D>): void;
  registerEventHandler(eventHandler: IHermesViewEventHandler): Promise<void>;
  inspect<S extends Dict = Dict>(
    viewIdentifier: ViewIdentifier,
    adapter: ViewEventHandlerAdapter,
  ): Promise<IView<S>>;
}
