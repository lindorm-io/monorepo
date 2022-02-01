import { Credentials } from "../types";
import { baseParse } from "@lindorm-io/core";
import { includes } from "lodash";
import { ClientError } from "@lindorm-io/errors";

export const getCredentials = (value: string): Credentials => {
  const credentials = baseParse(value);

  if (!includes(credentials, ":")) {
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
