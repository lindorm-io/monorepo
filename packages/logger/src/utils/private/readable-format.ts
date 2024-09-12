import { isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import fastSafeStringify from "fast-safe-stringify";
import { blue, cyan, gray, green, red, white, yellow } from "picocolors";
import { Formatter } from "picocolors/types";
import { inspect } from "util";
import { LogLevel } from "../../enums";
import { LogContent } from "../../types";
import { InternalLog } from "../../types/private";

const colourise = (
  formatter: Formatter,
  input: string,
  colours: boolean = true,
): string => (colours ? formatter(input) : input);

const sanitise = (dict: Dict): Dict => JSON.parse(fastSafeStringify(dict));

const formatLevel = (level: LogLevel, colours: boolean = true): string => {
  switch (level) {
    case LogLevel.Error:
      return colourise(red, level.toUpperCase(), colours);
    case LogLevel.Warn:
      return colourise(yellow, level.toUpperCase(), colours);
    case LogLevel.Info:
      return colourise(green, level.toUpperCase(), colours);
    case LogLevel.Verbose:
      return colourise(cyan, level.toUpperCase(), colours);
    case LogLevel.Debug:
      return colourise(blue, level.toUpperCase(), colours);
    case LogLevel.Silly:
      return colourise(gray, level.toUpperCase(), colours);

    default:
      return colourise(white, "UNKNOWN", colours);
  }
};

const levelColor = (level: LogLevel, input: string, colours: boolean = true): string => {
  switch (level) {
    case LogLevel.Error:
      return colourise(red, input, colours);
    case LogLevel.Warn:
      return colourise(yellow, input, colours);
    case LogLevel.Silly:
      return colourise(gray, input, colours);

    default:
      return colourise(white, input, colours);
  }
};

const formatContent = (dict: Dict, colours: boolean = true): string =>
  inspect(sanitise(dict), {
    colors: colours !== false,
    depth: Infinity,
    compact: 5,
    breakLength: process.stdout.columns ? process.stdout.columns - 10 : 140,
    sorted: true,
  });

const colouriseError = (error: Error, colours: boolean = true): string => {
  const { errors, stack, ...rest } = error as any;

  if (Object.keys(rest).length) {
    const content = formatContent(rest, false);
    return `${colourise(red, stack, colours)}\n${colourise(red, content, colours)}`;
  }

  const content = error.stack ? error.stack : error;

  return `${colourise(red, content as string, colours)}`;
};

const readableContent = (
  content: LogContent,
  colours: boolean = true,
): string | undefined => {
  if (!content) return;

  if (content instanceof Error) {
    return colouriseError(content, colours);
  }

  if (content.error instanceof Error) {
    return colouriseError(content.error, colours);
  }

  if (isObject(content)) {
    return formatContent(content, colours);
  }
};

export const readableFormat = (log: InternalLog): string => {
  try {
    const time = colourise(gray, log.time.toISOString()) + " ";
    const colon = colourise(gray, ": ");
    const level = formatLevel(log.level);
    const message = levelColor(log.level, log.message);

    const scopeString = log.scope.length ? `[ ${log.scope.join(" | ")} ]` : undefined;
    const scope = scopeString ? " " + colourise(gray, scopeString) : "";

    const pre = `${time}${level}${colon}${message}${scope}`;

    const context =
      log.context && Object.keys(log.context).length ? log.context : undefined;
    const contentArray = [context, ...log.extra]
      .filter((d) => d)
      .map((d) => readableContent(d!));

    const content = contentArray.length ? `\n${contentArray.join("\n")}` : "";

    return `${pre}${content}`;
  } catch (err) {
    console.error("error when formatting message", err);

    return fastSafeStringify(log);
  }
};
