/**
 * Atomic version check-and-set for optimistic locking with null field cleanup.
 *
 * KEYS[1] = entity key
 * ARGV[1] = version field name
 * ARGV[2] = expected new version
 * ARGV[3] = number of null field names (N)
 * ARGV[4..4+N-1] = null field names to HDEL
 * ARGV[4+N..end] = field/value pairs for HSET
 *
 * Returns: 1 = success, 0 = version mismatch, -1 = key not found, -2 = non-numeric version
 */
export const VERSION_CHECK_HSET = `
local ver = redis.call('HGET', KEYS[1], ARGV[1])
if ver == false then return -1 end
local nver = tonumber(ver)
if nver == nil then return -2 end
if nver + 1 ~= tonumber(ARGV[2]) then return 0 end
local nullCount = tonumber(ARGV[3])
if nullCount > 0 then
  local nullFields = {}
  for i = 1, nullCount do
    nullFields[i] = ARGV[3 + i]
  end
  redis.call('HDEL', KEYS[1], unpack(nullFields))
end
local hsetStart = 4 + nullCount
if #ARGV >= hsetStart then
  redis.call('HSET', KEYS[1], unpack(ARGV, hsetStart))
end
return 1
`;

/**
 * EXISTS guard before HINCRBY (zombie prevention).
 *
 * Prevents incrementing a field on a key that has been deleted
 * but not yet garbage-collected from scan results.
 *
 * KEYS[1] = entity key
 * ARGV[1] = field name
 * ARGV[2] = increment amount
 *
 * Returns: nil = key not found, otherwise the new value
 */
export const GUARDED_HINCRBY = `
if redis.call('EXISTS', KEYS[1]) == 0 then return nil end
return redis.call('HINCRBY', KEYS[1], ARGV[1], ARGV[2])
`;

/**
 * Float variant of GUARDED_HINCRBY.
 *
 * KEYS[1] = entity key
 * ARGV[1] = field name
 * ARGV[2] = increment amount (float)
 *
 * Returns: nil = key not found, otherwise the new value as string
 */
export const GUARDED_HINCRBYFLOAT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return nil end
return redis.call('HINCRBYFLOAT', KEYS[1], ARGV[1], ARGV[2])
`;

/**
 * Atomic EXISTS guard before HSET for unversioned updates (zombie prevention).
 *
 * Prevents HSET on a key that does not exist — without this guard, HSET on a
 * missing key silently creates a ghost record with only the updated fields
 * (no other columns, no validation).
 *
 * KEYS[1] = entity key
 * ARGV[1..end] = field/value pairs for HSET
 *
 * Returns: 1 = success, 0 = key not found
 */
export const GUARDED_HSET = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
redis.call('HSET', KEYS[1], unpack(ARGV))
return 1
`;
