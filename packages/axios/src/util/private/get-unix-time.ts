export const getUnixTime = (date: Date = new Date()): number => Math.floor(date.getTime() / 1000);
