import { randomUUID } from "crypto";
import { Client, ClientOptions } from "../../entity";

export const createTestClient = (options: Partial<ClientOptions> = {}): Client =>
  new Client({
    active: true,
    name: "Test Client Name",
    publicKeyId: randomUUID(),
    ...options,
  });
