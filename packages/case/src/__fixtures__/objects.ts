export const TEST_OBJECT = {
  camelCase: true,
  "Capital Case": true,
  CONSTANT_CASE: true,
  "dot.case": true,
  "kebab-case": true,
  "lower case": true,
  PascalCase: true,
  "path/case": true,
  "Sentence case": true,
  snake_case: true,
};

export const TEST_ARRAY_WITH_OBJECTS = [TEST_OBJECT, TEST_OBJECT];

/**
 * RFC 9396 §2 — the fields inside an `authorization_details` entry are defined
 * by the schema named in `type`, MAY legitimately be camelCase, and must not be
 * case-converted. Shaped to exercise depth through an array.
 */
export const TEST_DEEP_OBJECT = {
  grantType: "authorization_code",
  authorizationDetails: [
    {
      type: "payment_initiation",
      instructedAmount: { currencyCode: "EUR", amountValue: "123.50" },
    },
  ],
};

export const TEST_DEEP_ARRAY = [
  { outerKey: { middleKey: { innerKey: true } } },
  { outerKey: { middleKey: { innerKey: false } } },
];
