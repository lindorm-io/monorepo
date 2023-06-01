import { REGEX } from "../../constants";
import { MatchString } from "../../types";
import { getDuration } from "./get-duration";

export const matchString = (string: string): MatchString => {
  const result = new RegExp(REGEX).exec(string.toLowerCase());

  if (!result?.groups?.duration || !result?.groups?.value) {
    throw new Error(`Invalid string time value [ ${string} ]`);
  }

  const duration = getDuration(result.groups.duration);
  const number = parseInt(result.groups.value);

  return { duration, number };
};
