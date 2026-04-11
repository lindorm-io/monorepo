import { ClientError } from "@lindorm/errors";
import { assertSubjectUnchanged } from "./assert-subject-unchanged";

describe("assertSubjectUnchanged", () => {
  test("does not throw when subjects match", () => {
    expect(() => assertSubjectUnchanged("alice", "alice")).not.toThrow();
  });

  test("throws when subjects differ", () => {
    expect(() => assertSubjectUnchanged("alice", "bob")).toThrow(ClientError);
  });

  test("throws when expected is undefined", () => {
    expect(() => assertSubjectUnchanged(undefined, "alice")).toThrow(ClientError);
  });

  test("throws when actual is undefined", () => {
    expect(() => assertSubjectUnchanged("alice", undefined)).toThrow(ClientError);
  });
});
