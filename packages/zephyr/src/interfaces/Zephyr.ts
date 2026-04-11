import type { ZephyrError } from "../errors/ZephyrError";
import type { EventIncoming, EventOutgoing, ZephyrEventMap } from "../types/event-map";
import type { IZephyrRoom } from "./ZephyrRoom";

export type AuthExpiredEvent = {
  expiresAt?: number;
};

export type AuthExpiredHandler = (event: AuthExpiredEvent) => void;

export interface IZephyr<E extends ZephyrEventMap = ZephyrEventMap> {
  readonly id: string | undefined;
  readonly connected: boolean;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  refresh(): Promise<void>;

  emit<K extends string & keyof E>(event: K, data?: EventOutgoing<E, K>): Promise<void>;
  request<K extends string & keyof E>(
    event: K,
    data?: EventOutgoing<E, K>,
    options?: { timeout?: number },
  ): Promise<EventIncoming<E, K>>;

  on<K extends string & keyof E>(
    event: K,
    handler: (data: EventIncoming<E, K>) => void,
  ): void;
  once<K extends string & keyof E>(
    event: K,
    handler: (data: EventIncoming<E, K>) => void,
  ): void;
  off<K extends string & keyof E>(
    event: K,
    handler?: (data: EventIncoming<E, K>) => void,
  ): void;

  room(name: string): IZephyrRoom;

  onConnect(handler: () => void): void;
  onDisconnect(handler: (reason: string) => void): void;
  onError(handler: (error: ZephyrError) => void): void;
  onReconnect(handler: (attempt: number) => void): void;
  onAuthExpired(handler: AuthExpiredHandler): () => void;
}
