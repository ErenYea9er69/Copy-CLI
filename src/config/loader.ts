import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConfigSchema, DEFAULT_CONFIG, type Config } from "./schema.js";

export function loadConfig(cwd: string, explicitPath?: string): Config {
  const path = explicitPath ? resolve(cwd, explicitPath) : resolve(cwd, "copyshed.config.json");

  if (!existsSync(path)) {
    return DEFAULT_CONFIG;
  }

  const raw = readFileSync(path, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`copyshed.config.json is not valid JSON: ${(err as Error).message}`);
  }

  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`copyshed.config.json failed validation:\n${issues}`);
  }

  return result.data;
}
