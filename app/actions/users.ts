"use server";

import { signupUser } from "../dbActions";
import crypto from "crypto";
import { getUsersContainer } from "../lib/db";
import type { User } from "../types";

export async function createUserAccountAction(
  _prevState: { ok: boolean; message?: string },
  formData: FormData,
) {
  try {
    const username = String(formData.get("username") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const role = (String(formData.get("role") || "student") as "student" | "instructor" | "administrator");

    await signupUser(username, "", role, email, password);
    return { ok: true, message: "User created." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create user.";
    return { ok: false, message };
  }
}

export async function fetchUsers(): Promise<User[]> {
  const container = await getUsersContainer();
  const { resources } = await container.items
    .query({
      query: "SELECT c.username, c.displayName, c.email, c.role, c.createdAt FROM c ORDER BY c.username",
    })
    .fetchAll();
  return (resources ?? []) as User[];
}

export async function updateUserAccountAction(
  _prevState: { ok: boolean; message?: string },
  formData: FormData,
) {
  try {
    const username = String(formData.get("username") || "").trim();
    const displayName = String(formData.get("displayName") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const role = String(formData.get("role") || "student").trim() as "student" | "instructor" | "administrator";

    if (!username || !email) {
      throw new Error("Username and email are required.");
    }

    const container = await getUsersContainer();
    const { resources } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.username = @username",
        parameters: [{ name: "@username", value: username }],
      })
      .fetchAll();

    if (!resources?.length) {
      throw new Error("User not found.");
    }

    const { resources: emailMatches } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.email = @email AND c.username != @username",
        parameters: [
          { name: "@email", value: email },
          { name: "@username", value: username },
        ],
      })
      .fetchAll();
    if (emailMatches.length > 0) {
      throw new Error("Email already in use.");
    }

    const user = resources[0] as User & Record<string, any>;
    const updated = {
      ...user,
      id: user.id ?? user.username ?? username,
      username: user.username ?? username,
      email,
      role,
      displayName: displayName || username,
    };

    const { resource: containerInfo } = await container.read();
    const pkPath = containerInfo?.partitionKey?.paths?.[0] ?? "/id";
    const pkField = pkPath.replace(/^\//, "");

    const getPartitionKeyValue = (record: Record<string, any>) => {
      if (!pkField) return undefined;
      const segments = pkField.split("/");
      let value: any = record;
      for (const segment of segments) {
        if (value && typeof value === "object" && segment in value) {
          value = value[segment];
        } else {
          return undefined;
        }
      }
      return value;
    };

    const itemId = updated.id ?? username;
    const currentPartitionKey = getPartitionKeyValue(user);
    const updatedPartitionKey = getPartitionKeyValue(updated);

    if (currentPartitionKey) {
      if (updatedPartitionKey && updatedPartitionKey !== currentPartitionKey) {
        try {
          await container.item(itemId, currentPartitionKey).delete();
        } catch (deleteError) {
          const statusCode =
            (deleteError as { statusCode?: number; code?: number }).statusCode ??
            (deleteError as { code?: number }).code;
          if (statusCode !== 404) throw deleteError;
        }
        await container.items.create({ ...updated, id: itemId });
      } else {
        await container.item(itemId, currentPartitionKey).replace(updated);
      }
    } else {
      await container.items.upsert(updated);
    }
    return { ok: true, message: "User updated." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user.";
    return { ok: false, message };
  }
}

export async function resetUserPasswordAction(
  _prevState: { ok: boolean; message?: string },
  formData: FormData,
) {
  try {
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");

    if (!username || !password || password.length < 8) {
      throw new Error("Username and a password (8+ chars) are required.");
    }

    const container = await getUsersContainer();
    const { resources } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.username = @username",
        parameters: [{ name: "@username", value: username }],
      })
      .fetchAll();

    if (!resources?.length) {
      throw new Error("User not found.");
    }

    const user = resources[0] as User & Record<string, any>;
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");

    const updated = {
      ...user,
      id: user.id ?? user.username ?? username,
      username: user.username ?? username,
      passwordHash: hash,
      passwordSalt: salt,
    };

    await container.items.upsert(updated);
    return { ok: true, message: "Password reset." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reset password.";
    return { ok: false, message };
  }
}
