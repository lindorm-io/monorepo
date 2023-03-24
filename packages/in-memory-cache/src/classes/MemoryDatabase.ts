import { IMemoryDatabase, MemoryCollection } from "../types";
import { filter, find, remove } from "lodash";

export class MemoryDatabase implements IMemoryDatabase {
  private readonly state: Record<string, any>;

  public constructor() {
    this.state = {};
  }

  public collection<Data>(name: string): MemoryCollection<Data> {
    if (!this.state[name]) {
      this.state[name] = [];
    }

    return {
      delete: (data: Partial<Data>) => this.delete(name, data),
      filter: (data: Partial<Data>) => this.filter(name, data),
      find: (data: Partial<Data>) => this.find(name, data),
      insert: (data: Data) => this.insert(name, data),
    };
  }

  private delete<Data>(name: string, data: Partial<Data>): void {
    remove(this.state[name], data as any);
  }

  private filter<Data>(name: string, data?: Partial<Data>): Array<Data> {
    if (!data) {
      return this.state[name];
    }

    return filter(this.state[name], data);
  }

  private find<Data>(name: string, data: Partial<Data>): Data | undefined {
    return find(this.state[name], data);
  }

  private insert<Data>(name: string, data: Data): void {
    this.state[name].push(data);
  }
}
