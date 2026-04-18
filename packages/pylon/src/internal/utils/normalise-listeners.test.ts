import { PylonListener } from "../../classes/PylonListener";
import { normaliseListeners } from "./normalise-listeners";

describe("normaliseListeners", () => {
  test("should return empty array when input is undefined", () => {
    expect(normaliseListeners(undefined)).toEqual([]);
  });

  test("should wrap a bare string in an array", () => {
    expect(normaliseListeners("/some/path")).toEqual(["/some/path"]);
  });

  test("should wrap a bare PylonListener instance in an array", () => {
    const listener = new PylonListener();

    expect(normaliseListeners(listener)).toEqual([listener]);
  });

  test("should pass through an array of strings unchanged", () => {
    const input = ["/one", "/two"];

    expect(normaliseListeners(input)).toBe(input);
  });

  test("should pass through an array of PylonListener instances unchanged", () => {
    const input = [new PylonListener(), new PylonListener()];

    expect(normaliseListeners(input)).toBe(input);
  });

  test("should pass through a mixed array of strings and PylonListener instances", () => {
    const input: Array<string | PylonListener> = ["/scan/path", new PylonListener()];

    expect(normaliseListeners(input)).toBe(input);
  });
});
