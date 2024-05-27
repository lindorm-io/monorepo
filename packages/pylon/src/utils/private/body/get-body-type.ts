import { Context } from "koa";
import { BodyType } from "../../../enums";

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

const isJsonBody = (ctx: Context): boolean => Boolean(ctx.is(JSON_TYPES));

const isUrlEncodedBody = (ctx: Context): boolean => Boolean(ctx.is("urlencoded"));

const isTextBody = (ctx: Context): boolean => Boolean(ctx.is("text/*"));

const isMultipartBody = (ctx: Context): boolean => Boolean(ctx.is("multipart"));

export const getBodyType = (ctx: Context): BodyType => {
  if (isJsonBody(ctx)) return BodyType.Json;
  if (isUrlEncodedBody(ctx)) return BodyType.UrlEncoded;
  if (isTextBody(ctx)) return BodyType.Text;
  if (isMultipartBody(ctx)) return BodyType.Multipart;

  return BodyType.Unknown;
};
