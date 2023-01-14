import { Credentials } from "../types";
import { baseParse } from "@lindorm-io/core";
import { ClientError } from "@lindorm-io/errors";

export const getCredentials = (value: string): Credentials => {
  const credentials = baseParse(value);

  if (!credentials.includes(":")) {
    throw new ClientError("Invalid Authorization", {
      description: "Malformed header",
      statusCode: ClientError.StatusCode.UNAUTHORIZED,
    });
  }

  const [username, password] = credentials.split(":");

  return {
    username,
    password,
  };
};
