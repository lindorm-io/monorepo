import EventEmitter from "events";
import { ConnectionBaseOptions, IConnectionBase } from "../types";
import { ConnectionStatus } from "../enum";
import { LindormError } from "@lindorm-io/errors";
import { Logger } from "@lindorm-io/winston";
import { sleep } from "@lindorm-io/core";

export abstract class ConnectionBase<Client, ClientOptions> implements IConnectionBase<Client> {
  private readonly connectInterval: number;
  private readonly connectTimeout: number;
  private connectionStatus: ConnectionStatus;

  protected readonly eventEmitter: EventEmitter;
  protected clientConnection: Client;
  protected connectOptions: ClientOptions;
  protected logger: Logger;

  protected constructor(options: ConnectionBaseOptions<ClientOptions>, logger: Logger) {
    this.logger = logger.createChildLogger(["ConnectionBase", this.constructor.name]);
    this.eventEmitter = new EventEmitter();

    this.connectOptions = options.connectOptions;
    this.connectInterval = options.connectInterval || 250;
    this.connectTimeout = options.connectTimeout || 10000;
    this.connectionStatus = ConnectionStatus.DISCONNECTED;
  }

  // abstract

  protected abstract createClientConnection(): Promise<Client>;

  protected abstract connectCallback(): Promise<void>;

  protected abstract disconnectCallback(): Promise<void>;

  // properties

  public get client(): Client {
    return this.clientConnection;
  }
  public set client(_: Client) {
    throw new LindormError("Invalid operation");
  }

  public get status(): ConnectionStatus {
    return this.connectionStatus;
  }
  public set status(_: ConnectionStatus) {
    throw new LindormError("Invalid operation");
  }

  public get isConnected(): boolean {
    return this.connectionStatus === ConnectionStatus.CONNECTED;
  }
  public set isConnected(_: boolean) {
    /* ignored */
  }

  public get isConnecting(): boolean {
    return this.connectionStatus === ConnectionStatus.CONNECTING;
  }
  public set isConnecting(_: boolean) {
    /* ignored */
  }

  public get isDisconnected(): boolean {
    return this.connectionStatus === ConnectionStatus.DISCONNECTED;
  }
  public set isDisconnected(_: boolean) {
    /* ignored */
  }

  // public

  public async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    if (this.isConnecting) {
      return this.waitForConnection();
    }

    try {
      this.setStatus(ConnectionStatus.CONNECTING);

      this.clientConnection = await this.connectWithRetry();
      await this.connectCallback();

      if (!this.isConnected) {
        this.setStatus(ConnectionStatus.CONNECTED);
      }

      this.logger.info("Connection successful");
    } catch (err) {
      this.logger.error("Connection error", err);
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.clientConnection) return;
    if (this.isDisconnected) return;

    await this.disconnectCallback();
    this.clientConnection = undefined;

    this.setStatus(ConnectionStatus.DISCONNECTED);

    this.logger.info("Disconnect successful");
  }

  public on(eventName: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(eventName, listener);
  }

  // protected

  protected setStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
    this.eventEmitter.emit(this.connectionStatus);
    this.logger.debug("Status change", { status });
  }

  protected async waitForConnection(): Promise<void> {
    if (this.isConnected) return;

    return new Promise((resolve, reject) => {
      let current = 0;

      const interval = setInterval(() => {
        current += this.connectInterval;

        if (this.isConnected) {
          clearInterval(interval);
          resolve();
        }

        if (current >= this.connectTimeout) {
          clearInterval(interval);
          reject(new LindormError("Connection Timeout"));
        }
      }, this.connectInterval);
    });
  }

  // protected event handlers

  protected onError(err: Error): void {
    this.setStatus(ConnectionStatus.DISCONNECTED);

    this.logger.warn("Connection error", err);

    this.connect().then();
  }

  // private

  private async connectWithRetry(startDate = Date.now()): Promise<Client> {
    try {
      return await this.createClientConnection();
    } catch (err) {
      this.logger.debug("Connection error", err);

      await sleep(this.connectInterval);

      if (Date.now() > startDate + this.connectTimeout) {
        throw new LindormError("Connection Timeout", { error: err });
      }

      return this.connectWithRetry(startDate);
    }
  }
}
