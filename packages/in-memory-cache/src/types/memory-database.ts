export interface MemoryCollection<T> {
  delete(data: Partial<T>): void;
  filter(data?: Partial<T>): Array<T>;
  find(data: Partial<T>): T | undefined;
  insert(data: T): void;
}

export interface IMemoryDatabase {
  collection<T>(name: string): MemoryCollection<T>;
}
