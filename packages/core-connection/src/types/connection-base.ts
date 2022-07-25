import { ConnectionStatus } from "../enum";
import { ILogger } from "@lindorm-io/winston";

export interface IConnectionBase<Client> {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  on(eventName: string, listener: (...args: any[]) => void): void;

  client: Client;
  status: ConnectionStatus;
}

export interface ConnectionBaseOptions<ClientOptions> {
  connectOptions?: ClientOptions;
  connectInterval?: number;
  connectTimeout?: number;
  logger: ILogger;
}
