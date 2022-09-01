import { IN_MEMORY_VIEW_STORE } from "./in-memory";
import { filter, find } from "lodash";
import {
  HandlerIdentifier,
  IMemoryRepository,
  State,
  ViewRepositoryData,
  ViewStoreAttributes,
} from "../../types";

export class MemoryViewRepository<TState extends State = State>
  implements IMemoryRepository<TState>
{
  private readonly view: HandlerIdentifier;

  public constructor(view: HandlerIdentifier) {
    this.view = { name: view.name, context: view.context };
  }

  public async find(
    findFilter: Partial<ViewStoreAttributes> = {},
  ): Promise<Array<ViewRepositoryData<TState>>> {
    const filtered = filter(IN_MEMORY_VIEW_STORE, {
      ...this.view,
      ...findFilter,
      destroyed: false,
    });

    return filtered.map((item) => ({
      id: item.id,
      state: item.state as TState,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
  }

  public async findById(id: string): Promise<ViewRepositoryData<TState>> {
    return this.findOne({ id });
  }

  public async findOne(
    findFilter: Partial<ViewStoreAttributes> = {},
  ): Promise<ViewRepositoryData<TState>> {
    const found = find(IN_MEMORY_VIEW_STORE, { ...this.view, ...findFilter, destroyed: false });

    return {
      id: found.id,
      state: found.state as TState,
      created_at: found.created_at,
      updated_at: found.updated_at,
    };
  }
}
