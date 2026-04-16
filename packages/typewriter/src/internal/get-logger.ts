import { ILogger, Logger, LoggerOptions } from "@lindorm/logger";

export const getLogger = (options: ILogger | LoggerOptions | undefined): ILogger => {
  const scope = ["Typewriter"];

  if (!options) {
    return new Logger({ scope });
  }

  if ((options as ILogger).__instanceof === "Logger") {
    return (options as ILogger).child(scope);
  }

  return new Logger({ ...options, scope } as LoggerOptions);
};
