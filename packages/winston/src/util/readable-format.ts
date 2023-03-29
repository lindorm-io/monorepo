import chalk, { Chalk } from "chalk";
import fastSafeStringify from "fast-safe-stringify";
import { ConsoleOptions, LogDetails, LoggerMessage, LogLevel } from "@lindorm-io/core-logger";
import { inspect } from "util";
import { isObject } from "@lindorm-io/core";

const colourise = (chalk: Chalk, colours: boolean, input: string): string =>
  colours ? chalk(input) : input;

const sanitise = (object: Record<string, any>): Record<string, any> => {
  return JSON.parse(fastSafeStringify(object));
};

const formatLevel = (level: string, colours: boolean): string => {
  switch (level) {
    case LogLevel.ERROR:
      return colourise(chalk.red, colours, level.toUpperCase());
    case LogLevel.WARN:
      return colourise(chalk.yellow, colours, level.toUpperCase());
    case LogLevel.INFO:
      return colourise(chalk.green, colours, level.toUpperCase());
    case LogLevel.VERBOSE:
      return colourise(chalk.cyan, colours, level.toUpperCase());
    case LogLevel.DEBUG:
      return colourise(chalk.blueBright, colours, level.toUpperCase());
    case LogLevel.SILLY:
      return colourise(chalk.grey, colours, level.toUpperCase());
    default:
      return colourise(chalk.whiteBright, colours, level.toUpperCase());
  }
};

const levelColor = (level: string, colours: boolean, input: string): string => {
  switch (level) {
    case LogLevel.ERROR:
      return colourise(chalk.red, colours, input);
    case LogLevel.WARN:
      return colourise(chalk.yellow, colours, input);
    default:
      return colourise(chalk.whiteBright, colours, input);
  }
};

const formatContent = (details: Record<string, any>, colours: boolean): string => {
  return inspect(sanitise(details), {
    colors: colours !== false,
    depth: Infinity,
    compact: 5,
    breakLength: process.stdout.columns ? process.stdout.columns - 10 : 140,
    sorted: true,
  });
};

const readableDetails = (logDetails: LogDetails, colours: boolean): string | undefined => {
  if (logDetails instanceof Error) {
    const { errors, stack, ...rest } = logDetails as any;

    if (Object.keys(rest).length) {
      const details = formatContent(rest, false);
      return `${colourise(chalk.red, colours, stack)}\n${colourise(chalk.red, colours, details)}`;
    }

    const details = logDetails.stack ? logDetails.stack : logDetails;

    return `${colourise(chalk.red, colours, details as string)}`;
  }

  if (isObject(logDetails)) {
    return formatContent(logDetails, colours);
  }
};

export const readableFormat = (info: LoggerMessage, options: Partial<ConsoleOptions>): string => {
  const { colours = false, session = false, timestamp = false } = options;

  if (!info.time || !info.context) {
    return formatContent(info, false);
  }

  try {
    const time = colourise(chalk.black, colours, info.time.toISOString());
    const colon = colourise(chalk.black, colours, ":");
    const level = formatLevel(info.level, colours);
    const message = levelColor(info.level, colours, info.message);

    const contextValues = info.context ? Object.values(info.context) : [];
    const contextString = contextValues.length ? `[ ${contextValues.join(" | ")} ]` : undefined;
    const context = contextString ? colourise(chalk.black, colours, contextString) : "";

    const content = `${level}${colon} ${message} ${context}`;
    const formatted = timestamp ? `${time}  ${content}` : content;

    const detailsArray = info.details.map((d) => readableDetails(d, colours));

    if (session && Object.values(info.session).length) {
      detailsArray.unshift(colourise(chalk.black, colours, formatContent(info.session, false)));
    }

    const details = detailsArray.length ? `\n${detailsArray.join("\n")}` : "";

    return `${formatted}${details}`;
  } catch (err) {
    console.error("error when formatting message", err);
    return fastSafeStringify(info);
  }
};
