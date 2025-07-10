import {
  ViewData,
  ViewIdentifier,
  ViewStoreAttributes,
  ViewStoreSource,
  ViewUpdateAttributes,
  ViewUpdateFilter,
} from "../types";
import { IHermesMessage } from "./HermesMessage";
import { IViewModel } from "./ViewModel";

export interface IHermesViewStore {
  load(viewIdentifier: ViewIdentifier, source: ViewStoreSource): Promise<ViewData>;
  loadCausations(
    viewIdentifier: ViewIdentifier,
    source: ViewStoreSource,
  ): Promise<Array<string>>;
  save(
    view: IViewModel,
    causation: IHermesMessage,
    source: ViewStoreSource,
  ): Promise<ViewData>;
  saveCausations(view: IViewModel, source: ViewStoreSource): Promise<ViewData>;
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
