import { Dict } from "@lindorm/types";
import type ServerFormData from "form-data";
import { ConduitContext } from "../../types";

const newServerFormData = async (): Promise<ServerFormData> => {
  if (typeof window !== "undefined") {
    throw new Error("Stream requests are not supported in the browser");
  }

  const ServerFormData = await import("form-data");

  return new ServerFormData.default();
};

type Result = {
  data: ServerFormData | FormData | Dict<unknown> | undefined;
  headers: Dict<string>;
};

export const composeAxiosData = async (ctx: ConduitContext): Promise<Result> => {
  if (ctx.req.stream) {
    const form = await newServerFormData();

    form.append(ctx.req.filename ?? "file", ctx.req.stream);

    return {
      data: form,
      headers: form.getHeaders(),
    };
  }

  if (ctx.req.form) {
    return {
      data: ctx.req.form,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };
  }

  if (ctx.req.body && Object.keys(ctx.req.body).length) {
    return {
      data: ctx.req.body,
      headers: {
        "Content-Type": "application/json",
      },
    };
  }

  return { data: {}, headers: {} };
};
