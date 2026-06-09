import { existsSync } from "fs";
import { isAbsolute, resolve } from "path";
import { Scanner } from "@lindorm/scanner";
import { ProteusSource } from "../../classes/ProteusSource.js";
import { ProteusError } from "../../errors/ProteusError.js";

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
    throw new ProteusError(`Source file not found: ${resolved}`, {
      code: "source_file_not_found",
      title: "Source File Not Found",
      details:
        "No file exists at the resolved source path; check the path passed to the CLI.",
      data: { filePath },
      debug: { resolved },
    });
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
      throw new ProteusError(
        `Export "${exportName}" is not a ProteusSource instance. ` +
          `Available ProteusSource exports: ${sources.map((s) => s.name).join(", ") || "(none)"}`,
        {
          code: "export_not_proteus_source",
          title: "Export Not Proteus Source",
          details:
            "The named export is not a ProteusSource instance; choose one of the available source exports.",
          data: { exportName, available: sources.map((s) => s.name) },
        },
      );
    }
    return match.source;
  }

  if (sources.length === 0) {
    throw new ProteusError(
      `No ProteusSource instance found in ${resolved}. ` +
        "Ensure the file exports a ProteusSource instance.",
      {
        code: "no_proteus_source_found",
        title: "No Proteus Source Found",
        details: "The file must export a ProteusSource instance for the CLI to use.",
        data: { filePath },
        debug: { resolved },
      },
    );
  }

  if (sources.length > 1) {
    throw new ProteusError(
      `Multiple ProteusSource instances found: ${sources.map((s) => s.name).join(", ")}. ` +
        "Use --export <name> to select one.",
      {
        code: "multiple_proteus_sources_found",
        title: "Multiple Proteus Sources Found",
        details:
          "The file exports more than one ProteusSource; pass --export to select which one to use.",
        data: { available: sources.map((s) => s.name) },
      },
    );
  }

  return sources[0].source;
};
