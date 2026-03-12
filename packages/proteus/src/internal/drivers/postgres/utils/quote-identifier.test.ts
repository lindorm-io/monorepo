import {
  quoteIdentifier,
  quoteQualifiedName,
} from "../../../drivers/postgres/utils/quote-identifier";
import { ProteusError } from "../../../../errors";

describe("quoteIdentifier", () => {
  test("wraps a plain name in double quotes", () => {
    expect(quoteIdentifier("users")).toMatchSnapshot();
  });

  test("wraps a name containing uppercase in double quotes", () => {
    expect(quoteIdentifier("MyTable")).toMatchSnapshot();
  });

  test("escapes embedded double quotes by doubling them", () => {
    expect(quoteIdentifier('say "hello"')).toMatchSnapshot();
  });

  test("handles names with spaces", () => {
    expect(quoteIdentifier("my table")).toMatchSnapshot();
  });

  test("handles names with special characters", () => {
    expect(quoteIdentifier("my-schema.my_table")).toMatchSnapshot();
  });

  test("handles a single double-quote character", () => {
    expect(quoteIdentifier('"')).toMatchSnapshot();
  });

  test("handles multiple consecutive double quotes", () => {
    expect(quoteIdentifier('a""b')).toMatchSnapshot();
  });

  test("throws ProteusError for an empty string", () => {
    expect(() => quoteIdentifier("")).toThrow(ProteusError);
  });

  // A whitespace-only string is truthy so it passes the !name guard and gets quoted literally.
  test("wraps a whitespace-only string in double quotes (not treated as empty)", () => {
    expect(quoteIdentifier("   ")).toMatchSnapshot();
  });
});

describe("quoteQualifiedName", () => {
  test("combines namespace and name when namespace is provided", () => {
    expect(quoteQualifiedName("public", "users")).toMatchSnapshot();
  });

  test("returns only quoted name when namespace is null", () => {
    expect(quoteQualifiedName(null, "users")).toMatchSnapshot();
  });

  test("handles namespace with special characters", () => {
    expect(quoteQualifiedName("my-schema", "orders")).toMatchSnapshot();
  });

  test("quotes both namespace and name independently", () => {
    expect(quoteQualifiedName('sch"ema', 'ta"ble')).toMatchSnapshot();
  });

  // An empty string namespace is falsy — it is treated the same as null, so only the name is quoted.
  test("returns only quoted name when namespace is empty string (falsy, treated as null)", () => {
    expect(quoteQualifiedName("", "users")).toMatchSnapshot();
  });
});
