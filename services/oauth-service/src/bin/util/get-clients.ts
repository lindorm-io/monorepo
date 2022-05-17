import { Client } from "../../entity";
import { mongoConnection } from "../../instance";
import { ClientRepository } from "../../infrastructure";
import { logger } from "./logger";

export const getClients = async (): Promise<Array<Client>> => {
  await mongoConnection.waitForConnection();
  const repository = new ClientRepository({ db: mongoConnection.database(), logger });
  return repository.findMany();
};
