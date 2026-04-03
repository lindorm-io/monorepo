import { BodyType, PylonHttpContext } from "../../../types";

const JSON_TYPES = [
  "application/csp-report",
  "application/json-patch+json",
  "application/json",
  "application/ld+json",
  "application/prs.hal-forms+json",
  "application/vnd.api+json",
  "application/vnd.geo+json",
  "application/vnd.jcard",
  "application/vnd.jcard+json",
];

const isJsonBody = (ctx: PylonHttpContext): boolean => Boolean(ctx.is(JSON_TYPES));

const isUrlEncodedBody = (ctx: PylonHttpContext): boolean =>
  Boolean(ctx.is("urlencoded"));

const isTextBody = (ctx: PylonHttpContext): boolean => Boolean(ctx.is("text/*"));

const isMultipartBody = (ctx: PylonHttpContext): boolean => Boolean(ctx.is("multipart"));

export const getBodyType = (ctx: PylonHttpContext): BodyType => {
  if (isJsonBody(ctx)) return "json";
  if (isUrlEncodedBody(ctx)) return "urlencoded";
  if (isTextBody(ctx)) return "text";
  if (isMultipartBody(ctx)) return "multipart";

  return "unknown";
};
