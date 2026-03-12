export const encodePkSegment = (value: unknown): string => {
  if (value == null) {
    throw new Error("PK segment value must not be null or undefined");
  }
  return encodeURIComponent(String(value));
};

export const decodePkSegment = (segment: string): string => decodeURIComponent(segment);
