import { isObject, isString } from "@lindorm/is";
import { IScanData, Scanner } from "@lindorm/scanner";
import { Constructor, Dict } from "@lindorm/types";
import type { MessageScannerInput } from "../../../types/source-options";
import { IrisScannerError } from "../errors/IrisScannerError";

export class MessageScanner {
  public static async scan<T extends Dict = Dict>(
    input: MessageScannerInput,
  ): Promise<Array<Constructor<T>>> {
    const messages = input.filter(
      (a) => !isObject(a) && !isString(a) && (a as unknown as T).prototype,
    ) as Array<Constructor<T>>;
    const strings = input.filter((a) => isString(a));
    const result: Array<Constructor<T>> = [...messages];
    if (!strings.length) return result;
    for (const path of strings) {
      const item = MessageScanner.scanner.scan(path);
      if (item.isDirectory) {
        result.push(...(await MessageScanner.scanDirectory<T>(item)));
      }
      if (item.isFile) {
        result.push(...(await MessageScanner.scanFile<T>(item)));
      }
    }
    return result;
  }

  // private

  private static async scanDirectory<T extends Dict = Dict>(
    data: IScanData,
  ): Promise<Array<Constructor<T>>> {
    const result: Array<Constructor<T>> = [];
    for (const child of data.children) {
      if (child.isDirectory) {
        result.push(...(await MessageScanner.scanDirectory<T>(child)));
      }
      if (child.isFile) {
        result.push(...(await MessageScanner.scanFile<T>(child)));
      }
    }
    return result;
  }

  private static async scanFile<T extends Dict = Dict>(
    data: IScanData,
  ): Promise<Array<Constructor<T>>> {
    let module: Record<string, unknown>;
    try {
      module = await MessageScanner.scanner.import<Record<string, unknown>>(
        data.fullPath,
      );
    } catch (err) {
      throw new IrisScannerError(
        `Failed to load message from "${data.fullPath}": ${err instanceof Error ? err.message : String(err)}`,
        {
          error: err instanceof Error ? err : undefined,
          debug: { filePath: data.fullPath },
        },
      );
    }
    const values = Object.values(module);
    if (values.length === 0) {
      throw new IrisScannerError(`No messages found in file: ${data.fullPath}`);
    }
    const result: Array<Constructor<T>> = [];
    for (const value of values) {
      if ((value as Constructor<T>).prototype) {
        result.push(value as Constructor<T>);
      }
    }
    if (result.length === 0) {
      throw new IrisScannerError(`No messages found in file: ${data.fullPath}`);
    }
    return result;
  }

  private static get scanner(): Scanner {
    return new Scanner({
      deniedFilenames: [/^index$/],
      deniedTypes: [/^fixture$/, /^spec$/, /^test$/, /^integration$/],
    });
  }
}
