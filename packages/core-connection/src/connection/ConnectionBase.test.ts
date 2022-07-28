import { ConnectionBase } from "./ConnectionBase";
import { ConnectionBaseOptions } from "../types";
import { createMockLogger } from "@lindorm-io/winston";

class Client {
  public constructor() {}
}

const connect = jest.fn().mockResolvedValue(new Client());
const connectCallback = jest.fn();
const disconnectCallback = jest.fn();

interface ClientOptions {}

class Connection extends ConnectionBase<Client, ClientOptions> {
  public constructor(options: ConnectionBaseOptions<ClientOptions>) {
    super(options, createMockLogger());
  }

  protected async createClientConnection(): Promise<Client> {
    return await connect();
  }

  protected async connectCallback(): Promise<void> {
    connectCallback();
  }

  protected async disconnectCallback(): Promise<void> {
    disconnectCallback();
  }
}

describe("ConnectionBase", () => {
  let connection: Connection;

  beforeEach(async () => {
    connection = new Connection({});

    await connection.connect();
  });

  test("should connect", async () => {
    expect(connectCallback).toHaveBeenCalled();

    expect(connection.client).toStrictEqual(expect.any(Client));
  });

  test("should disconnect", async () => {
    await expect(connection.disconnect()).resolves.toBeUndefined();

    expect(disconnectCallback).toHaveBeenCalled();
  });

  test("should return status", () => {
    expect(connection.status).toBe("connected");
  });
});
