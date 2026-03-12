import { ProteusError } from "../../errors";

/**
 * Validates that a driver config does not provide both `url` and individual
 * connection fields (`host`, `port`, `user`, `password`). Providing both is
 * ambiguous and likely a configuration mistake.
 */
export const validateConnectionMutualExclusivity = (options: {
  url?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
}): void => {
  if (!options.url) return;

  const individualFields: Array<string> = [];

  if (options.host != null) individualFields.push("host");
  if (options.port != null) individualFields.push("port");
  if (options.user != null) individualFields.push("user");
  if (options.password != null) individualFields.push("password");

  if (individualFields.length > 0) {
    throw new ProteusError(
      `Connection options are mutually exclusive: when "url" is provided, ` +
        `individual connection fields must not be set. ` +
        `Found both "url" and: ${individualFields.join(", ")}`,
    );
  }
};
