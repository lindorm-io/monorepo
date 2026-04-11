import { ClientError } from "@lindorm/errors";

export const assertSubjectUnchanged = (
  expected: string | undefined,
  actual: string | undefined,
): void => {
  if (!expected || !actual || expected !== actual) {
    throw new ClientError("Refresh subject mismatch", {
      details: "The refreshed token subject does not match the original",
      status: ClientError.Status.Unauthorized,
    });
  }
};
