import {
  ViewClearProcessedCausationIdsData,
  ViewEventHandlerAdapter,
  ViewIdentifier,
  ViewStoreAttributes,
  ViewUpdateData,
  ViewUpdateFilter,
} from "../types";
import { IHermesMessage } from "./HermesMessage";
import { IView } from "./View";

export interface IHermesViewStore {
  causationExists(
    viewIdentifier: ViewIdentifier,
    causation: IHermesMessage,
    adapter: ViewEventHandlerAdapter,
  ): Promise<boolean>;
  clearProcessedCausationIds(
    view: IView,
    adapter: ViewEventHandlerAdapter,
  ): Promise<IView>;
  load(viewIdentifier: ViewIdentifier, adapter: ViewEventHandlerAdapter): Promise<IView>;
  processCausationIds(view: IView, adapter: ViewEventHandlerAdapter): Promise<void>;
  save(
    view: IView,
    causation: IHermesMessage,
    adapter: ViewEventHandlerAdapter,
  ): Promise<IView>;
}

export interface IViewStore {
  causationExists(
    viewIdentifier: ViewIdentifier,
    causation: IHermesMessage,
  ): Promise<boolean>;
  clearProcessedCausationIds(
    filter: ViewUpdateFilter,
    data: ViewClearProcessedCausationIdsData,
    adapter: ViewEventHandlerAdapter,
  ): Promise<void>;
  find(
    viewIdentifier: ViewIdentifier,
    adapter: ViewEventHandlerAdapter,
  ): Promise<ViewStoreAttributes | undefined>;
  insert(
    attributes: ViewStoreAttributes,
    adapter: ViewEventHandlerAdapter,
  ): Promise<void>;
  insertProcessedCausationIds(
    viewIdentifier: ViewIdentifier,
    causationIds: Array<string>,
  ): Promise<void>;
  update(
    filter: ViewUpdateFilter,
    data: ViewUpdateData,
    adapter: ViewEventHandlerAdapter,
  ): Promise<void>;
}
