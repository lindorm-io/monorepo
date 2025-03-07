import { isObjectLike, isString } from "@lindorm/is";
import { Dict } from "@lindorm/types";

type PylonErrorBody = {
  id: string;
  code: string;
  data: Dict;
  message: string;
  name: string;
  support: string;
  title: string;
};

export const isPylonError = (body: any): body is PylonErrorBody =>
  isObjectLike(body) &&
  body.server === "Pylon" &&
  body.error &&
  isString(body.error.id) &&
  isString(body.error.code) &&
  isObjectLike(body.error.data) &&
  isString(body.error.message) &&
  isString(body.error.name) &&
  isString(body.error.support) &&
  isString(body.error.title);
