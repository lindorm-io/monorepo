import fastSafeStringify from "fast-safe-stringify";
import { ConsoleOptions, LogDetails, LoggerMessage } from "@lindorm-io/core-logger";
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

const readableDetails = (logDetails: LogDetails, colours: boolean): string | undefined => {
  if (logDetails instanceof Error) {
    const { errors, stack, ...rest } = logDetails as any;

    if (Object.keys(rest).length) {
      const details = formatContent(rest, false);
      return `${stack}\n${details}`;
    }

    return (logDetails.stack ? logDetails.stack : logDetails) as string;
  }

  if (isObject(logDetails)) {
    return formatContent(logDetails, colours);
  }
};

export const readableFormat = (info: LoggerMessage, options: Partial<ConsoleOptions>): string => {
  const { colours = false, timestamp = false } = options;

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

    if (Object.values(info.session).length) {
      info.details.unshift(info.session);
    }

    const detailsArray = info.details.map((d) => readableDetails(d, colours));
    const details = detailsArray.length ? `\n${detailsArray.join("\n")}` : "";

    return `${formatted}${details}`;
  } catch (err) {
    console.error("error when formatting message", err);
    return fastSafeStringify(info);
  }
};
