/**
 * Derives a camelCased method name from a generated expression's source —
 * `"I encrypt {string} in record mode"` → `iEncryptInRecordMode`. Parameter
 * slots contribute nothing; a name that would start with a digit (or come out
 * empty) is prefixed with `step` so the snippet stays pasteable.
 */
export const toMethodName = (expressionSource: string): string => {
  const name = expressionSource
    .replace(/\{[^}]*\}/g, " ")
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word.length > 0)
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join("");

  if (/^[A-Za-z]/.test(name)) {
    return name;
  }

  return `step${name.charAt(0).toUpperCase()}${name.slice(1)}`;
};
