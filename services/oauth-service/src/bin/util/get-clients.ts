import { Client } from "../../entity";
import { mongoConnection } from "../../instance";
import { ClientRepository } from "../../infrastructure";
import { logger } from "./logger";

export const getClients = async (): Promise<Array<Client>> => {
  const repository = new ClientRepository(mongoConnection, logger);
  return repository.findMany();
};
