import { ConnectionStatus } from "../enum";

export interface ConnectionBaseOptions<ClientOptions> {
  connectOptions?: ClientOptions;
  connectInterval?: number;
  connectTimeout?: number;
}

export interface ExtendedConnectionBaseOptions<ClientOptions>
  extends ConnectionBaseOptions<ClientOptions> {
  type: string;
}

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
