import fastSafeStringify from "fast-safe-stringify";
import { ConsoleOptions, LoggerMessage } from "@lindorm-io/core-logger";
import { inspect } from "util";
import { isObject } from "@lindorm-io/core";

const sanitize = (object: Record<string, any>): Record<string, any> => {
  return JSON.parse(fastSafeStringify(object));
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
    const time = info.time.toISOString();
    const level = info.level.toUpperCase();
    const message = info.message;

    const contextValues = info.context ? Object.values(info.context) : [];
    const context = contextValues.length ? ` [ ${contextValues.join(" | ")} ]` : "";

    const content = `${level}: ${message}${context}`;
    const formatted = timestamp ? `${time}  ${content}` : content;

    if (info.details instanceof Error) {
      const { errors, stack, ...rest } = info.details as any;

      if (Object.keys(rest).length) {
        const details = formatContent(rest, false);

        return `${formatted}\n${stack}\n${details}`;
      }

      const details = info.details.stack ? info.details.stack : info.details;

      return `${formatted}\n${details as string}`;
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
