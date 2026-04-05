import type { Constructor } from "@lindorm/types";
import type {
  IrisConnectionState,
  IrisEvents,
  MessageScannerInput,
  SessionOptions,
} from "../types";
import type { IMessage } from "./Message";
import type { IMessageSubscriber } from "./MessageSubscriber";
import type { IIrisMessagingProvider } from "./IrisMessagingProvider";
import type { IIrisSession } from "./IrisSession";

export interface IIrisSource extends IIrisMessagingProvider {
  readonly messages: ReadonlyArray<Constructor<IMessage>>;

  addMessages(input: MessageScannerInput): void;
  addSubscriber(subscriber: IMessageSubscriber): void;
  removeSubscriber(subscriber: IMessageSubscriber): void;
  session(options?: SessionOptions): IIrisSession;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  drain(timeout?: number): Promise<void>;
  setup(): Promise<void>;
  getConnectionState(): IrisConnectionState;
  on<K extends keyof IrisEvents>(
    event: K,
    listener: (...args: IrisEvents[K]) => void,
  ): void;
  off<K extends keyof IrisEvents>(
    event: K,
    listener: (...args: IrisEvents[K]) => void,
  ): void;
  once<K extends keyof IrisEvents>(
    event: K,
    listener: (...args: IrisEvents[K]) => void,
  ): void;
}
