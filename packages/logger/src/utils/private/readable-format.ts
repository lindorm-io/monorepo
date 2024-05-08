import { isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import fastSafeStringify from "fast-safe-stringify";
import { black, blue, cyan, gray, green, red, white, yellow } from "picocolors";
import { Formatter } from "picocolors/types";
import { inspect } from "util";
import { LogLevel } from "../../enums";
import { LogDetails } from "../../types";
import { _Log } from "../../types/private";

const colourise = (formatter: Formatter, input: string, colours: boolean = true): string =>
  colours ? formatter(input) : input;

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
    const details = formatContent(rest, false);
    return `${colourise(red, stack, colours)}\n${colourise(red, details, colours)}`;
  }

  const details = error.stack ? error.stack : error;

  return `${colourise(red, details as string, colours)}`;
};

const readableDetails = (logDetails: LogDetails, colours: boolean = true): string | undefined => {
  if (!logDetails) return;

  if (logDetails instanceof Error) {
    return colouriseError(logDetails, colours);
  }

  if (logDetails.error instanceof Error) {
    return colouriseError(logDetails.error, colours);
  }

  if (isObject(logDetails)) {
    return formatContent(logDetails, colours);
  }
};

export const _readableFormat = (log: _Log): string => {
  if (!log.time || !log.context) {
    return formatContent(log, false);
  }

  try {
    const time = colourise(black, log.time.toISOString());
    const colon = colourise(black, ":");
    const level = formatLevel(log.level);
    const message = levelColor(log.level, log.message);

    const contextValues = log.context ? Object.values(log.context) : [];
    const contextString = contextValues.length ? `[ ${contextValues.join(" | ")} ]` : undefined;
    const context = contextString ? colourise(black, contextString) : "";

    const content = `${time}  ${level}${colon} ${message} ${context}`;

    const detailsArray = log.details.map((d) => readableDetails(d));

    const details = detailsArray.length ? `\n${detailsArray.join("\n")}` : "";

    return `${content}${details}`;
  } catch (err) {
    console.error("error when formatting message", err);

    return fastSafeStringify(log);
  }
};
