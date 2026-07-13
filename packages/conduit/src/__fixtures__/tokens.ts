/**
 * Realistic (but fake — never fetched, never verified) credentials used to prove that log
 * redaction strips the parts that make a token usable.
 */

export const TEST_JWT_HEADER =
  "eyJhbGciOiJFUzI1NiIsImtpZCI6ImtleV8wMUhaIiwidHlwIjoiSldUIn0";

export const TEST_JWT_PAYLOAD =
  "eyJzdWIiOiJ1c2VyXzAxSFoiLCJhdWQiOiJhcGkiLCJzY29wZSI6Im9wZW5pZCIsImV4cCI6MTg5MzQ1NjAwMH0";

export const TEST_JWT_SIGNATURE = "LnvzRK9BF7wJmXK2dQeYpN0aVh4TgUcS1oIbW3fMxDq";

export const TEST_JWT = `${TEST_JWT_HEADER}.${TEST_JWT_PAYLOAD}.${TEST_JWT_SIGNATURE}`;

export const TEST_OPAQUE_TOKEN = "dc7d6e1b9c1f4d2a8e0b3c5f7a9d1e2b";

export const TEST_USERNAME = "client_01HZ";

export const TEST_PASSWORD = "s3cr3t-p4ssw0rd";

/** `B64.encode(`${TEST_USERNAME}:${TEST_PASSWORD}`)` */
export const TEST_BASIC_CREDENTIAL = "Y2xpZW50XzAxSFo6czNjcjN0LXA0c3N3MHJk";
