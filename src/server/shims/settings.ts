// Keys and service settings on the phone: the same routes and rules as the desktop, stored in
// the app's private data folder (other apps can't read it) instead of a settings.json file.

import { Hono } from "hono";
import { z } from "zod";
import { SETTING_FIELDS, type SettingKey, type SettingsStatus } from "@/lib/settings";
import { TEST_KEYS, testConnection, validServiceUrl } from "@server/settings-test";
import { files } from "../../storage/files";

type Values = Partial<Record<SettingKey, string>>;
const schema = z.object(Object.fromEntries(SETTING_FIELDS.map(({ key }) => [key, z.string().trim().max(4096).refine((v) => !/[\r\n\0]/.test(v)).optional()]))).strict();

let cache: Values = {};

/** Read the saved settings once at startup; setting() is synchronous after that. */
export async function loadSettings() {
  try {
    const text = await files.readText("settings.json");
    cache = text ? (schema.parse(JSON.parse(text)) as Values) : {};
  } catch {
    cache = {};
  }
}

export function setting(key: SettingKey): string {
  return cache[key]?.trim() ?? "";
}

function status(): SettingsStatus {
  return Object.fromEntries(
    SETTING_FIELDS.map(({ key, secret }) => {
      const value = cache[key] ?? "";
      return [key, { configured: !!value, ...(!secret ? { value } : {}) }];
    })
  ) as SettingsStatus;
}

export const settingsRoutes = new Hono();

settingsRoutes.get("/api/settings", (c) => c.json(status()));

settingsRoutes.put("/api/settings", async (c) => {
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Check the settings values and try again." }, 400);
  const values = parsed.data as Values;
  if (values.LLM_BASE_URL && !validServiceUrl(values.LLM_BASE_URL)) return c.json({ error: "AI service address must be an HTTP or HTTPS URL without credentials, query parameters or a fragment." }, 400);
  cache = { ...cache, ...values };
  await files.writeText("settings.json", JSON.stringify(cache));
  return c.json(status());
});

settingsRoutes.post("/api/settings/test", async (c) => {
  const parsed = z.object({ key: z.enum(TEST_KEYS), values: schema }).strict().safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Check the settings values and try again." }, 400);
  const draft = parsed.data.values as Values;
  return c.json(await testConnection(parsed.data.key, (key) => draft[key] ?? cache[key] ?? ""));
});
