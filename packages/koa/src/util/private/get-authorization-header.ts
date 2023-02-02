import { AuthorizationHeader } from "../../types";
import { ClientError } from "@lindorm-io/errors";
import { DefaultLindormKoaContext } from "../../types";

export const getAuthorizationHeader =
  (ctx: DefaultLindormKoaContext) => (): AuthorizationHeader => {
    const header = ctx.get("Authorization");

    if (!header) {
      throw new ClientError("Invalid Authorization", {
        debug: { notes: "Header is missing" },
        statusCode: ClientError.StatusCode.UNAUTHORIZED,
      });
    }

    const split = header.split(" ");

    if (split.length !== 2) {
      throw new ClientError("Invalid Authorization", {
        description: "Malformed header",
        debug: { header, notes: "Header must include two strings" },
        statusCode: ClientError.StatusCode.UNAUTHORIZED,
      });
    }

    const type = split[0];
    const value = split[1];

    switch (type) {
      case "Basic":
      case "Bearer":
        break;

      default:
        throw new ClientError("Invalid Authorization", {
          description: "Unexpected type",
          debug: { header, type, value },
          statusCode: ClientError.StatusCode.UNAUTHORIZED,
        });
    }

    return { type, value };
  };
