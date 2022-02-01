import { includes } from "lodash";

export const sanitiseToken = (token: string): string => {
  if (!token || !includes(token, ".")) return token;

  const split = token.split(".");

  if (split.length !== 3) return token;

  return `${split[0]}.${split[1]}`;
};
