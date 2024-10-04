import {
  ViewEventHandlerAdapter,
  ViewIdentifier,
  ViewStoreAttributes,
  ViewUpdateAttributes,
  ViewUpdateFilter,
} from "../types";
import { IHermesMessage } from "./HermesMessage";
import { IView } from "./View";

export interface IHermesViewStore {
  load(viewIdentifier: ViewIdentifier, adapter: ViewEventHandlerAdapter): Promise<IView>;
  loadCausations(
    viewIdentifier: ViewIdentifier,
    adapter: ViewEventHandlerAdapter,
  ): Promise<Array<string>>;
  save(
    view: IView,
    causation: IHermesMessage,
    adapter: ViewEventHandlerAdapter,
  ): Promise<IView>;
  saveCausations(view: IView, adapter: ViewEventHandlerAdapter): Promise<IView>;
}

export interface IViewStore {
  findCausationIds(viewIdentifier: ViewIdentifier): Promise<Array<string>>;
  findView(viewIdentifier: ViewIdentifier): Promise<ViewStoreAttributes | undefined>;
  insertCausationIds(
    viewIdentifier: ViewIdentifier,
    causationIds: Array<string>,
  ): Promise<void>;
  insertView(attributes: ViewStoreAttributes): Promise<void>;
  updateView(filter: ViewUpdateFilter, data: ViewUpdateAttributes): Promise<void>;
}
