import type { Fields, Files, Options } from "formidable";
import formidable from "formidable";
import { PylonHttpContext } from "../../../types";

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

  return new Promise((resolve, reject) => {
    form.parse(ctx.req, (err, fields, files) => {
      if (err) {
        return reject(err as Error);
      }
      resolve({ parsed: fields, files, raw: ctx.request.body });
    });
  });
};
