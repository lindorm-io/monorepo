import { NotImplementedError } from "@lindorm/errors";
import { isObject } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type ServerFormData from "form-data";
import type { ConduitContext } from "../../types/index.js";
import { composeUrlEncoded } from "./compose-url-encoded.js";

const URL_ENCODED = "application/x-www-form-urlencoded" as const;

const newServerFormData = async (): Promise<ServerFormData> => {
  if (typeof window !== "undefined") {
    throw new NotImplementedError("Stream requests are not supported in the browser", {
      code: "browser_stream_unsupported",
      title: "Browser Stream Unsupported",
      details:
        "Streaming multipart uploads rely on the Node-only form-data package and cannot run in a browser environment; send the payload as a body or form instead.",
      type: "urn:lindorm:conduit:error:browser_stream_unsupported",
    });
  }

  const ServerFormData = await import("form-data");

  return new ServerFormData.default();
};

type Result = {
  data: ServerFormData | FormData | URLSearchParams | Dict<unknown> | undefined;
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
    for (const value of ctx.req.form.values()) {
      if (!(value instanceof File)) continue;

      return {
        data: ctx.req.form,
        headers: {},
      };
    }

    // A file-free form is a urlencoded payload, not a multipart one. Axios
    // ignores a Content-Type override on a `FormData` and serialises it as
    // multipart regardless — hand it `URLSearchParams` so the request really
    // goes out as `application/x-www-form-urlencoded` (RFC 6749 §4.4.2 requires
    // exactly that for a token request).
    //
    // The loop above returned for any File entry, so every value left is a string.
    return {
      data: composeUrlEncoded(ctx.req.form.entries()),
      headers: {
        "Content-Type": URL_ENCODED,
      },
    };
  }

  if (ctx.req.body !== undefined && ctx.req.body !== null) {
    if (isObject(ctx.req.body) && Object.keys(ctx.req.body).length) {
      // Read here rather than in a middleware on purpose: compose runs after the
      // whole middleware chain, so the encoding cannot depend on where a caller
      // registered `conduitChangeRequestBodyMiddleware` — the body is already in
      // its final shape by now.
      if (ctx.req.contentType === URL_ENCODED) {
        return {
          data: composeUrlEncoded(Object.entries(ctx.req.body)),
          headers: {
            "Content-Type": URL_ENCODED,
          },
        };
      }

      return {
        data: ctx.req.body,
        headers: {
          "Content-Type": "application/json",
        },
      };
    }

    if (!isObject(ctx.req.body)) {
      // An already-serialised body is passed through, but a declared
      // contentType still has to reach the wire.
      return {
        data: ctx.req.body,
        headers: ctx.req.contentType ? { "Content-Type": ctx.req.contentType } : {},
      };
    }
  }

  return { data: undefined, headers: {} };
};
