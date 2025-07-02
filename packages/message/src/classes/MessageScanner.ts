import { isObject, isString } from "@lindorm/is";
import { IScanData, Scanner } from "@lindorm/scanner";
import { Constructor, Dict } from "@lindorm/types";
import { MessageScannerError } from "../errors";
import { MessageScannerInput } from "../types";

export class MessageScanner {
  public static scan<T extends Dict = Dict>(
    input: MessageScannerInput<T>,
  ): Array<Constructor<T>> {
    const messages = input.filter(
      (a) => !isObject(a) && !isString(a) && (a as T).prototype,
    ) as Array<Constructor<T>>;

    const strings = input.filter((a) => isString(a));

    const result: Array<Constructor<T>> = [...messages];

    if (!strings.length) return result;

    for (const path of strings) {
      const item = MessageScanner.scanner.scan(path);

      if (item.isDirectory) {
        result.push(...MessageScanner.scanDirectory<T>(item));
      }
      if (item.isFile) {
        result.push(MessageScanner.scanFile<T>(item));
      }
    }

    return result;
  }

  // private

  private static scanDirectory<T extends Dict = Dict>(
    data: IScanData,
  ): Array<Constructor<T>> {
    const result: Array<Constructor<T>> = [];

    for (const child of data.children) {
      if (child.isDirectory) {
        result.push(...MessageScanner.scanDirectory<T>(child));
      }
      if (child.isFile) {
        result.push(MessageScanner.scanFile<T>(child));
      }
    }

    return result;
  }

  private static scanFile<T extends Dict = Dict>(data: IScanData): Constructor<T> {
    const module = MessageScanner.scanner.require<Constructor<T>>(data.fullPath);

    const entries = Object.entries(module);
    if (entries.length === 0) {
      throw new MessageScannerError(`No messages found in file: ${data.fullPath}`);
    }

    let result: Partial<Constructor<T>> | null = null;

    for (const value of Object.values(module)) {
      if (result) break;

      if (value.prototype) {
        result = value;
        continue;
      }
    }

    if (!result) {
      throw new MessageScannerError(`No messages found in file: ${data.fullPath}`);
    }

    return result as Constructor<T>;
  }

  private static get scanner(): Scanner {
    return new Scanner({
      deniedFilenames: [/^index$/],
      deniedTypes: [/^fixture$/, /^spec$/, /^test$/, /^integration$/],
    });
  }
}
