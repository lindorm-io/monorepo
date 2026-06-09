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
      "securityTxt.contact must be a non-empty string or array of non-empty strings",
      {
        code: "invalid_security_txt_contact",
        title: "Invalid security.txt Contact",
        details:
          "securityTxt.contact must be a non-empty string or an array of non-empty strings.",
        type: "urn:lindorm:pylon:error:invalid_security_txt_contact",
        data: { contact: input.contact },
      },
    );
  }

  const expires = input.expires instanceof Date ? input.expires : new Date(input.expires);

  if (isNaN(expires.getTime())) {
    throw new ServerError("securityTxt.expires does not parse to a valid Date", {
      code: "invalid_security_txt_expires",
      title: "Invalid security.txt Expires",
      details: "securityTxt.expires must be a value that parses to a valid Date.",
      type: "urn:lindorm:pylon:error:invalid_security_txt_expires",
      data: { expires: input.expires },
    });
  }

  const now = new Date();

  if (expires.getTime() < now.getTime()) {
    throw new ServerError("securityTxt.expires is in the past", {
      code: "expired_security_txt_expires",
      title: "Expired security.txt Expires",
      details: "securityTxt.expires is in the past and must be a future date.",
      type: "urn:lindorm:pylon:error:expired_security_txt_expires",
      data: { expires: expires.toISOString(), now: now.toISOString() },
    });
  }

  if (expires.getTime() > expiresAt(MAX_EXPIRES, now).getTime()) {
    throw new ServerError(
      `securityTxt.expires is more than ${MAX_EXPIRES} in the future`,
      {
        code: "security_txt_expires_too_far",
        title: "security.txt Expires Too Far",
        details: `securityTxt.expires must be no more than ${MAX_EXPIRES} in the future.`,
        type: "urn:lindorm:pylon:error:security_txt_expires_too_far",
        data: {
          expires: expires.toISOString(),
          maxExpires: expiresAt(MAX_EXPIRES, now).toISOString(),
        },
      },
    );
  }
};
