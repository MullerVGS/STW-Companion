// Local-only helpers (Node CLI). The Worker passes secrets in via bindings instead.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { DeviceAuth } from "./epic";

export function repoRoot(): string {
  return fileURLToPath(new URL("../../", import.meta.url));
}

export function dataDir(): string {
  return fileURLToPath(new URL("../.data/", import.meta.url));
}

export function fixturesDir(): string {
  return fileURLToPath(new URL("../fixtures/", import.meta.url));
}

/** Read EPIC_* device auth from the repo-root env/.env (git-ignored). */
export function loadDeviceAuth(): DeviceAuth {
  const text = readFileSync(repoRoot() + "env/.env", "utf8");
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  const accountId = env.EPIC_ACCOUNT_ID;
  const deviceId = env.EPIC_DEVICE_ID;
  const secret = env.EPIC_DEVICE_SECRET;
  if (!accountId || !deviceId || !secret) {
    throw new Error("Missing EPIC_ACCOUNT_ID / EPIC_DEVICE_ID / EPIC_DEVICE_SECRET in env/.env");
  }
  return { accountId, deviceId, secret };
}
