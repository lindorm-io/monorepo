import { renderSecurityTxt } from "./render-security-txt";

describe("renderSecurityTxt", () => {
  test("should render a full-field configuration", () => {
    const result = renderSecurityTxt({
      contact: "mailto:security@example.com",
      expires: new Date("2030-01-01T00:00:00Z"),
      acknowledgments: "https://example.com/hall-of-fame",
      canonical: "https://example.com/.well-known/security.txt",
      encryption: "https://example.com/pgp-key.txt",
      hiring: "https://example.com/jobs",
      policy: "https://example.com/security-policy",
      preferredLanguages: ["en", "sv"],
    });

    expect(result).toMatchSnapshot();
  });

  test("should render minimal configuration with only contact and expires", () => {
    const result = renderSecurityTxt({
      contact: "mailto:security@example.com",
      expires: new Date("2030-01-01T00:00:00Z"),
    });

    expect(result).toMatchSnapshot();
  });

  test("should render multiple Contact lines when contact is an array", () => {
    const result = renderSecurityTxt({
      contact: [
        "mailto:security@example.com",
        "https://example.com/contact",
        "tel:+1-201-555-0123",
      ],
      expires: new Date("2030-01-01T00:00:00Z"),
    });

    expect(result).toMatchSnapshot();
  });

  test("should normalise Date and ISO string expires to identical output", () => {
    const asDate = renderSecurityTxt({
      contact: "mailto:security@example.com",
      expires: new Date("2030-01-01T00:00:00Z"),
    });

    const asString = renderSecurityTxt({
      contact: "mailto:security@example.com",
      expires: "2030-01-01T00:00:00Z",
    });

    expect(asString).toBe(asDate);
  });

  test("should join preferredLanguages with comma and space", () => {
    const result = renderSecurityTxt({
      contact: "mailto:security@example.com",
      expires: new Date("2030-01-01T00:00:00Z"),
      preferredLanguages: ["en", "sv"],
    });

    expect(result).toContain("Preferred-Languages: en, sv");
  });
});
