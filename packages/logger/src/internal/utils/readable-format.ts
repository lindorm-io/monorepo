import { isArray, isObject } from "@lindorm/is";
import fastSafeStringify from "fast-safe-stringify";
import pc, { type Formatter } from "picocolors";
import type { LogContent, LogLevel } from "../../types/index.js";
import type { InternalLog } from "../types/internal-log.js";
import { inspectDictionary } from "../../utils/inspect-dictionary.js";

const colourise = (
  formatter: Formatter,
  input: string,
  colours: boolean = true,
): string => (colours ? formatter(input) : input);

const formatLevel = (level: LogLevel, colours: boolean = true): string => {
  switch (level) {
    case "error":
      return colourise(pc.red, level.toUpperCase(), colours);
    case "warn":
      return colourise(pc.yellow, level.toUpperCase(), colours);
    case "info":
      return colourise(pc.green, level.toUpperCase(), colours);
    case "verbose":
      return colourise(pc.cyan, level.toUpperCase(), colours);
    case "debug":
      return colourise(pc.blue, level.toUpperCase(), colours);
    case "silly":
      return colourise(pc.gray, level.toUpperCase(), colours);

    default:
      return colourise(pc.white, "UNKNOWN", colours);
  }
};

const levelColor = (level: LogLevel, input: string, colours: boolean = true): string => {
  switch (level) {
    case "error":
      return colourise(pc.red, input, colours);
    case "warn":
      return colourise(pc.yellow, input, colours);
    case "silly":
      return colourise(pc.gray, input, colours);

    default:
      return colourise(pc.white, input, colours);
  }
};

const colouriseError = (error: Error, colours: boolean = true): string => {
  const { errors, stack, ...rest } = error as any;

  if (Object.keys(rest).length) {
    const content = inspectDictionary(rest, false);
    return `${colourise(pc.red, stack, colours)}\n${colourise(pc.red, content, colours)}`;
  }

  const content = error.stack ? error.stack : error;

  return `${colourise(pc.red, content as string, colours)}`;
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
    return inspectDictionary(content, colours);
  }
};

const formatDuration = (ms: number): string => {
  const us = Math.round((ms % 1) * 1000);
  const totalMs = Math.floor(ms);
  const s = Math.floor(totalMs / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);

  const parts: string[] = [];

  if (h > 0) parts.push(`${h}h `);
  if (m % 60 > 0) parts.push(`${m % 60}m `);
  if (s % 60 > 0) parts.push(`${s % 60}s `);
  if (s < 60 && totalMs % 1000 > 0) parts.push(`${totalMs % 1000}ms `);
  if (s === 0 && us > 0) parts.push(`${us}µs `);

  return parts.length ? parts.join("").trim() : "0µs";
};

export const readableFormat = (log: InternalLog): string => {
  try {
    const time = colourise(pc.gray, log.time.toISOString()) + " ";
    const colon = colourise(pc.gray, ": ");
    const level = formatLevel(log.level);
    const message = levelColor(log.level, log.message);

    const scopeString = log.scope.length ? `[ ${log.scope.join(" | ")} ]` : undefined;
    const scope = scopeString ? " " + colourise(pc.gray, scopeString) : "";
    const duration =
      log.duration !== undefined
        ? " " + colourise(pc.gray, `(${formatDuration(log.duration)})`)
        : "";

    const pre = `${time}${level}${colon}${message}${duration}${scope}`;

    const context =
      log.context && Object.keys(log.context).length ? log.context : undefined;
    const extra = isArray(log.extra) && log.extra.length ? log.extra : [];
    const contentArray = [context, ...extra]
      .filter((d) => d)
      .map((d) => readableContent(d));

    const content = contentArray.length ? `\n${contentArray.join("\n")}` : "";

    return `${pre}${content}`;
  } catch (err) {
    console.error("error when formatting message", err);

    return fastSafeStringify(log);
  }
};
