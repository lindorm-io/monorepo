import { Logger, LogLevel } from "@lindorm-io/winston";

export const getLogger = (): Logger => {
  const winston = new Logger({
    packageName: "n",
    packageVersion: "v",
  });

  winston.addConsole(LogLevel.INFO);

  return winston;
};
