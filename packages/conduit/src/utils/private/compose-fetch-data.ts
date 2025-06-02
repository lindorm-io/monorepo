import { Dict } from "@lindorm/types";
import { ConduitContext } from "../../types";

type Result = {
  body: FormData | URLSearchParams | string | undefined;
  headers: Dict<string>;
};

export const composeFetchData = (ctx: ConduitContext): Result => {
  if (ctx.req.form) {
    for (const value of ctx.req.form.values()) {
      if (!(value instanceof File)) continue;

      return {
        body: ctx.req.form,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      };
    }

    const params = new URLSearchParams();

    ctx.req.form.forEach((value, key) => {
      params.append(key, value.toString());
    });

    return {
      body: params.toString(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };
  }

  if (ctx.req.body && Object.keys(ctx.req.body).length) {
    return {
      body: JSON.stringify(ctx.req.body),
      headers: {
        "Content-Type": "application/json",
      },
    };
  }

  return { body: undefined, headers: {} };
};
