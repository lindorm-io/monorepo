import type { Admin } from "mongodb";

/**
 * Detect whether the MongoDB server is running as a replica set.
 * Returns true if replica set, false if standalone.
 */
export const detectReplicaSet = async (admin: Admin): Promise<boolean> => {
  try {
    const status = await admin.command({ replSetGetStatus: 1 });
    return status.ok === 1;
  } catch {
    return false;
  }
};
