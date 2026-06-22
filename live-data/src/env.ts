// Path and credential helpers shared by local CLI commands and GitHub Actions.
import { existsSync, readFileSync } from "node:fs";
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

/** Read EPIC_* from the process environment (CI) or repo-root env/.env (local). */
export function loadDeviceAuth(): DeviceAuth {
  const values: Record<string, string | undefined> = {
    EPIC_ACCOUNT_ID: process.env.EPIC_ACCOUNT_ID,
    EPIC_DEVICE_ID: process.env.EPIC_DEVICE_ID,
    EPIC_DEVICE_SECRET: process.env.EPIC_DEVICE_SECRET,
  };
  const envFile = repoRoot() + "env/.env";
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !values[m[1]]) values[m[1]] = m[2].trim();
    }
  }
  const accountId = values.EPIC_ACCOUNT_ID;
  const deviceId = values.EPIC_DEVICE_ID;
  const secret = values.EPIC_DEVICE_SECRET;
  if (!accountId || !deviceId || !secret) {
    throw new Error(
      "Missing EPIC_ACCOUNT_ID / EPIC_DEVICE_ID / EPIC_DEVICE_SECRET in the environment or env/.env",
    );
  }
  return { accountId, deviceId, secret };
}
