export interface IZephyrRoom {
  readonly name: string;

  join(): Promise<void>;
  leave(): Promise<void>;
  emit(event: string, data?: any): Promise<void>;
  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler?: (data: any) => void): void;
}
