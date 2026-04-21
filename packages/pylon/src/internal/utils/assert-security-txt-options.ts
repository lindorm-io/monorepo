import { expiresAt, type ReadableTime } from "@lindorm/date";
import { ServerError } from "@lindorm/errors";
import type { PylonSecurityTxt } from "../../types/index.js";

const MAX_EXPIRES: ReadableTime = "1 year";

const hasContact = (contact: PylonSecurityTxt["contact"]): boolean => {
  if (Array.isArray(contact)) {
    return contact.length > 0 && contact.every((entry) => entry.trim().length > 0);
  }
  return typeof contact === "string" && contact.trim().length > 0;
};

export const assertSecurityTxtOptions = (input: PylonSecurityTxt): void => {
  if (!hasContact(input.contact)) {
    throw new ServerError(
      "Invalid securityTxt.contact: must be a non-empty string or array of non-empty strings",
    );
  }

  const expires = input.expires instanceof Date ? input.expires : new Date(input.expires);

  if (isNaN(expires.getTime())) {
    throw new ServerError(
      "Invalid securityTxt.expires: value does not parse to a valid Date",
    );
  }

  const now = new Date();

  if (expires.getTime() < now.getTime()) {
    throw new ServerError("Invalid securityTxt.expires: value is in the past");
  }

  if (expires.getTime() > expiresAt(MAX_EXPIRES, now).getTime()) {
    throw new ServerError(
      `Invalid securityTxt.expires: value is more than ${MAX_EXPIRES} in the future`,
    );
  }
};
