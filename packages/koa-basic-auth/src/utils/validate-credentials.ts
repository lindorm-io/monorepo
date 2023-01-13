import { Credentials } from "../types";
import { ClientError } from "@lindorm-io/errors";

const findClient = (username: string, clients: Array<Credentials>): Credentials => {
  for (const client of clients) {
    if (username !== client.username) continue;
    return client;
  }

  throw new ClientError("Invalid Authorization", {
    description: "Invalid credentials",
    statusCode: ClientError.StatusCode.UNAUTHORIZED,
  });
};

export const validateCredentials = (
  credentials: Credentials,
  clients: Array<Credentials>,
): void => {
  const client = findClient(credentials.username, clients);

  if (client.password === credentials.password) return;

  throw new ClientError("Invalid Authorization", {
    description: "Invalid credentials",
    statusCode: ClientError.StatusCode.UNAUTHORIZED,
  });
};
