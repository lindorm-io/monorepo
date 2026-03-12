import { existsSync } from "fs";
import { isAbsolute, resolve } from "path";
import { Scanner } from "@lindorm/scanner";
import { ProteusSource } from "../../classes/ProteusSource";

const PROTEUS_SOURCE_BRAND = Symbol.for("ProteusSource");

const isProteusSource = (val: unknown): val is ProteusSource =>
  val != null &&
  typeof val === "object" &&
  typeof (val as any).constructor === "function" &&
  (val as any).constructor[PROTEUS_SOURCE_BRAND] === true;

export const loadSource = async (
  filePath: string,
  exportName?: string,
): Promise<ProteusSource> => {
  const resolved = isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);

  if (!existsSync(resolved)) {
    throw new Error(`Source file not found: ${resolved}`);
  }

  const scanner = new Scanner();
  const module = await scanner.import<Record<string, unknown>>(resolved);

  const sources: Array<{ name: string; source: ProteusSource }> = [];

  for (const [name, value] of Object.entries(module)) {
    if (isProteusSource(value)) {
      sources.push({ name, source: value });
    }
  }

  if (exportName) {
    const match = sources.find((s) => s.name === exportName);
    if (!match) {
      throw new Error(
        `Export "${exportName}" is not a ProteusSource instance. ` +
          `Available ProteusSource exports: ${sources.map((s) => s.name).join(", ") || "(none)"}`,
      );
    }
    return match.source;
  }

  if (sources.length === 0) {
    throw new Error(
      `No ProteusSource instance found in ${resolved}. ` +
        "Ensure the file exports a ProteusSource instance.",
    );
  }

  if (sources.length > 1) {
    throw new Error(
      `Multiple ProteusSource instances found: ${sources.map((s) => s.name).join(", ")}. ` +
        "Use --export <name> to select one.",
    );
  }

  return sources[0].source;
};
