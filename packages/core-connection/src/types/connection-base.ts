import { ConnectionStatus } from "../enum";
import { Logger } from "@lindorm-io/winston";

export interface IConnectionBase<Client> {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  on(eventName: string, listener: (...args: any[]) => void): void;

  client: Client;
  status: ConnectionStatus;
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnected: boolean;
}

export interface ConnectionBaseOptions<ClientOptions> {
  connectOptions?: ClientOptions;
  connectInterval?: number;
  connectTimeout?: number;
  logger: Logger;
}
