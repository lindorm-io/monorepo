import type { Fields, File, Files, Options } from "formidable";
import formidable from "formidable";
import type { PylonHttpContext } from "../../../types/index.js";
import { orderFormidableFiles } from "./order-formidable-files.js";

type Result = {
  parsed: Fields;
  files: Files;
  raw: any;
};

export const parseWithFormidable = async (
  ctx: PylonHttpContext,
  options: Options = {},
): Promise<Result> => {
  const form = formidable({ multiples: true, ...options });

  // The order the parser reached each part — the client's order. formidable's
  // own `Files` map is ordered by write-flush completion instead, which races
  // (see `orderFormidableFiles`).
  const order: Array<File> = [];
  form.on("fileBegin", (_name, file) => {
    order.push(file);
  });

  return new Promise((resolve, reject) => {
    form.parse(ctx.req, (err, fields, files) => {
      if (err) {
        return reject(err as Error);
      }
      resolve({
        parsed: fields,
        files: orderFormidableFiles(files, order),
        raw: ctx.request.body,
      });
    });
  });
};
