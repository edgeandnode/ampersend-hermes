import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tmpPath = `${filePath}.tmp`;
  await fs.promises.writeFile(tmpPath, content, "utf-8");
  await fs.promises.rename(tmpPath, filePath);
}

function backupFile(filePath: string): Promise<void> {
  if (!fs.existsSync(filePath)) return Promise.resolve();
  const backupPath = `${filePath}.bak.${Date.now()}`;
  return fs.promises.copyFile(filePath, backupPath);
}

function resolveHermesDir(configDir: string): string {
  if (path.isAbsolute(configDir)) return configDir;
  if (configDir.startsWith("~/")) {
    return path.join(os.homedir(), configDir.slice(2));
  }
  return path.resolve(configDir);
}

// ---------------------------------------------------------------------------
// Hermes model config (for custom model routing if needed)
// ---------------------------------------------------------------------------

export interface PatchHermesModelOptions {
  /** Custom model base URL (e.g. for a local proxy). */
  baseUrl?: string;
  /** Model identifier. */
  model?: string;
}

/**
 * Patch Hermes `config.yaml` so `model.provider = "custom"` and
 * `model.base_url` points at a custom endpoint.
 */
export async function patchHermesModel(
  configDir: string,
  options: PatchHermesModelOptions = {},
): Promise<void> {
  const resolved = resolveHermesDir(configDir);
  await fs.promises.mkdir(resolved, { recursive: true });

  const yamlPath = path.join(resolved, "config.yaml");

  let doc: Record<string, unknown> = {};
  if (fs.existsSync(yamlPath)) {
    await backupFile(yamlPath);
    const raw = await fs.promises.readFile(yamlPath, "utf-8");
    const parsed = parseYaml(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      doc = parsed as Record<string, unknown>;
    }
  }

  const modelSection =
    (doc.model as Record<string, unknown> | undefined) ?? {};

  if (options.baseUrl) {
    modelSection.provider = "custom";
    modelSection.base_url = options.baseUrl;
  }

  if (options.model) {
    modelSection.name = options.model;
  }

  doc.model = modelSection;

  const out = stringifyYaml(doc, { lineWidth: 100 });
  await atomicWrite(yamlPath, out.endsWith("\n") ? out : `${out}\n`);
}

/**
 * Revert custom model overrides from Hermes config.
 */
export async function unpatchHermesModel(
  configDir: string,
): Promise<void> {
  const resolved = resolveHermesDir(configDir);
  const yamlPath = path.join(resolved, "config.yaml");

  if (!fs.existsSync(yamlPath)) return;

  await backupFile(yamlPath);
  const raw = await fs.promises.readFile(yamlPath, "utf-8");
  const parsed = parseYaml(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;

  const doc = parsed as Record<string, unknown>;
  const modelSection = doc.model as Record<string, unknown> | undefined;
  if (!modelSection) return;

  if (modelSection.provider === "custom") {
    delete modelSection.provider;
  }
  if (
    typeof modelSection.base_url === "string" &&
    modelSection.base_url.includes("127.0.0.1")
  ) {
    delete modelSection.base_url;
  }

  doc.model = modelSection;
  const out = stringifyYaml(doc, { lineWidth: 100 });
  await atomicWrite(yamlPath, out.endsWith("\n") ? out : `${out}\n`);
}
