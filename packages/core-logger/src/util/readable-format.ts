import chalk, { Chalk } from "chalk";
import fastSafeStringify from "fast-safe-stringify";
import { ConsoleOptions, LoggerMessage } from "../types";
import { LogLevel } from "../enum";
import { inspect } from "util";
import { isObject } from "lodash";

const colourise = (chalk: Chalk, colours: boolean, input: string): string =>
  colours ? chalk(input) : input;

const sanitize = (object: Record<string, any>): Record<string, any> => {
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
  return inspect(sanitize(details), {
    colors: colours !== false,
    depth: Infinity,
    compact: 5,
    breakLength: process.stdout.columns ? process.stdout.columns - 10 : 140,
    sorted: true,
  });
};

export const readableFormat = (info: LoggerMessage, options: Partial<ConsoleOptions>): string => {
  const { colours, timestamp } = options;

  if (!info.time || !info.context) {
    return formatContent(info, false);
  }

  try {
    const time = colourise(chalk.black, colours, info.time.toISOString());
    const colon = colourise(chalk.black, colours, ":");
    const level = formatLevel(info.level, colours);
    const message = levelColor(info.level, colours, info.message);

    const contextValues = info.context ? Object.values(info.context) : [];
    const context = contextValues.length
      ? colourise(chalk.black, colours, ` [ ${contextValues.join(" | ")} ]`)
      : "";

    const content = `${level}${colon} ${message}${context}`;
    const formatted = timestamp ? `${time}  ${content}` : content;

    if (info.details instanceof Error) {
      const { errors, stack, ...rest } = info.details as any;

      if (Object.keys(rest).length) {
        const details = formatContent(rest, false);

        return `${formatted}\n${colourise(chalk.red, colours, stack)}\n${colourise(
          chalk.red,
          colours,
          details,
        )}`;
      }

      const details = info.details.stack ? info.details.stack : info.details;

      return `${formatted}\n${colourise(chalk.red, colours, details as string)}`;
    }

    if (isObject(info.details)) {
      const details = formatContent(info.details, colours);
      return `${formatted}\n${details}`;
    }

    return formatted;
  } catch (err) {
    console.error("error when formatting message", err);
    return fastSafeStringify(info);
  }
};
