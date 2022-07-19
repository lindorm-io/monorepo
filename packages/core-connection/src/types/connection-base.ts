import EventEmitter from "events";
import { ConnectionStatus } from "../enum";
import { ILogger } from "@lindorm-io/winston";

export interface IConnectionBase<Client> extends EventEmitter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  client: Client;
  status: ConnectionStatus;
}

export interface ConnectionBaseOptions<ClientOptions> {
  connectOptions?: ClientOptions;
  connectInterval?: number;
  connectTimeout?: number;
  logger: ILogger;
}
