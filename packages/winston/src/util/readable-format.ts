import chalk from "chalk";
import fastSafeStringify from "fast-safe-stringify";
import { ExtendableError } from "@lindorm-io/errors";
import { LogLevel } from "../enum";
import { inspect } from "util";
import { isError, isObject } from "lodash";

const sanitize = (object: Record<string, any>): Record<string, any> => {
  return JSON.parse(fastSafeStringify(object));
};

const formatLevel = (level: string): string => {
  switch (level) {
    case LogLevel.ERROR:
      return chalk.red(level.toUpperCase());
    case LogLevel.WARN:
      return chalk.yellow(level.toUpperCase());
    case LogLevel.INFO:
      return chalk.green(level.toUpperCase());
    case LogLevel.VERBOSE:
      return chalk.cyan(level.toUpperCase());
    case LogLevel.DEBUG:
      return chalk.blueBright(level.toUpperCase());
    case LogLevel.SILLY:
      return chalk.grey(level.toUpperCase());
    default:
      return chalk.whiteBright(level.toUpperCase());
  }
};

const levelColor = (level: string, input: string): string => {
  switch (level) {
    case LogLevel.ERROR:
      return chalk.red(input);
    case LogLevel.WARN:
      return chalk.yellow(input);
    default:
      return chalk.whiteBright(input);
  }
};

const formatContent = (details: Record<string, any>, colors?: boolean): string => {
  return inspect(sanitize(details), {
    colors: colors !== false,
    depth: Infinity,
    compact: 5,
    breakLength: process.stdout.columns ? process.stdout.columns - 10 : 140,
    sorted: true,
  });
};

export const readableFormat = (msg: any): string => {
  if (!msg.time || !msg.context) {
    return formatContent(msg, false);
  }

  try {
    const time = chalk.black(msg.time.toISOString());
    const level = formatLevel(msg.level);
    const message = levelColor(msg.level, msg.message);

    const context = msg.context.length ? chalk.black(` [ ${msg.context.join(":")} ]`) : "";

    const formatted = `${time}  ${level}${chalk.black(":")} ${message}${context}`;

    if (isError(msg.details)) {
      if (msg.details instanceof ExtendableError) {
        const { id, errors, stack, ...rest } = msg.details;
        const details = formatContent(rest, false);

        return `${formatted}\n${chalk.red(stack)}\n${chalk.red(details)}`;
      }

      const details = msg.details.stack ? msg.details.stack : msg.details;

      return `${formatted}\n${chalk.red(details)}`;
    }

    if (isObject(msg.details)) {
      const details = formatContent(msg.details);
      return `${formatted}\n${details}`;
    }

    return formatted;
  } catch (err) {
    console.error("error when formatting message", err);
    return fastSafeStringify(msg);
  }
};
