export const resolveStreamKey = (prefix: string, topic: string): string => {
  return `${prefix}:${topic}`;
};
