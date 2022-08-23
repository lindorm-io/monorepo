import { filter, find } from "lodash";
import {
  HandlerIdentifier,
  IMemoryRepository,
  State,
  ViewRepositoryData,
  ViewStoreAttributes,
} from "../../types";
import { viewStoreSingleton } from "./singleton/view-store-singleton";

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
    const filtered = filter(viewStoreSingleton, { ...this.view, ...findFilter, destroyed: false });

    return filtered.map((item) => ({
      id: item.id,
      name: item.name,
      context: item.context,
      revision: item.revision,
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
    const found = find(viewStoreSingleton, { ...this.view, ...findFilter, destroyed: false });

    return {
      id: found.id,
      name: found.name,
      context: found.context,
      revision: found.revision,
      state: found.state as TState,
      created_at: found.created_at,
      updated_at: found.updated_at,
    };
  }
}
