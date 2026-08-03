import { describe, expect, test } from "vitest";
import { changeFormKeys } from "./change-form-keys.js";

describe("changeFormKeys", () => {
  test("should convert every field name", () => {
    const form = new FormData();

    form.append("grantType", "client_credentials");
    form.append("clientId", "client-id");
    form.append("PascalCase", "pascal");

    expect(Array.from(changeFormKeys(form, "snake").entries())).toMatchSnapshot();
  });

  test("should preserve repeated keys and entry order", () => {
    const form = new FormData();

    form.append("resourceIndicator", "https://one.lindorm.io");
    form.append("resourceIndicator", "https://two.lindorm.io");

    expect(Array.from(changeFormKeys(form, "snake").entries())).toMatchSnapshot();
  });

  test("should preserve files", () => {
    const form = new FormData();

    form.append("myFile", new File(["content"], "file.txt", { type: "text/plain" }));

    const [[key, value]] = Array.from(changeFormKeys(form, "snake").entries());

    expect(key).toBe("my_file");
    expect(value).toBeInstanceOf(File);
    expect((value as File).name).toBe("file.txt");
  });

  test("should leave field names untouched in none mode", () => {
    const form = new FormData();

    form.append("grantType", "client_credentials");

    expect(Array.from(changeFormKeys(form, "none").entries())).toMatchSnapshot();
  });
});
