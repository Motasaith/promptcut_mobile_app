// Projects saved on the phone, with the desktop's version history: automatic snapshots at most
// every ten minutes, plus named ones. Assets are saved with "/api/media/<file>" addresses, like
// the desktop, and handed to the editor as URLs this phone can load.

import { files } from "../../storage/files";
import { canonicalUrl, loadableUrl, prepareUrls } from "./media";

const AUTO_EVERY_MS = 10 * 60 * 1000;
const MAX_AUTO_VERSIONS = 30;

export interface ProjectFile {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  thumbnail: string | null;
  scene: unknown;
  assets: unknown[];
  kind?: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  thumbnail: string | null;
  kind?: string;
  duration?: number;
  format?: string;
}

export interface VersionSummary {
  id: string;
  at: number;
  label: string | null;
  auto: boolean;
}

type AssetLike = { src?: string; filmstrip?: string };

const validId = (id: string) => /^p_[0-9a-f]{12}$/.test(id);
const hex = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Assets as saved: portable addresses. */
function toStored(assets: unknown[]): unknown[] {
  return (assets as AssetLike[]).map((a) => ({ ...a, ...(a.src ? { src: canonicalUrl(a.src) } : {}), ...(a.filmstrip ? { filmstrip: canonicalUrl(a.filmstrip) } : {}) }));
}

/** Assets as the editor needs them: URLs this phone can load. */
async function toLive(assets: unknown[]): Promise<unknown[]> {
  const list = assets as AssetLike[];
  await prepareUrls(list.flatMap((a) => [a.src ?? "", a.filmstrip ?? ""]));
  return list.map((a) => ({ ...a, ...(a.src ? { src: loadableUrl(a.src) } : {}), ...(a.filmstrip ? { filmstrip: loadableUrl(a.filmstrip) } : {}) }));
}

async function readProject(id: string): Promise<ProjectFile | null> {
  if (!validId(id)) return null;
  const text = await files.readText(`projects/${id}.json`);
  if (!text) return null;
  try {
    return JSON.parse(text) as ProjectFile;
  } catch {
    return null;
  }
}

async function writeProject(p: ProjectFile) {
  await files.writeText(`projects/${p.id}.json`, JSON.stringify(p));
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const out: ProjectSummary[] = [];
  for (const f of await files.list("projects")) {
    if (!f.endsWith(".json")) continue;
    const p = await readProject(f.replace(/\.json$/, ""));
    if (!p) continue;
    const scene = p.scene as { duration?: number; width?: number; height?: number };
    const ratio = scene.width && scene.height ? (scene.width > scene.height ? "16:9" : scene.width < scene.height ? "9:16" : "1:1") : undefined;
    out.push({ id: p.id, title: p.title, createdAt: p.createdAt, updatedAt: p.updatedAt, thumbnail: p.thumbnail, kind: p.kind, duration: scene.duration, format: ratio });
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<ProjectFile | null> {
  const p = await readProject(id);
  return p ? { ...p, assets: await toLive(p.assets ?? []) } : null;
}

export async function createProject(data: { title?: string; scene: unknown; assets?: unknown[]; kind?: string }): Promise<ProjectFile> {
  const now = Date.now();
  const p: ProjectFile = {
    id: `p_${hex(6)}`,
    title: (data.title ?? "Untitled project").slice(0, 100),
    createdAt: now,
    updatedAt: now,
    thumbnail: null,
    scene: data.scene,
    assets: toStored(data.assets ?? []),
    kind: data.kind,
  };
  await writeProject(p);
  return p;
}

export async function saveProject(id: string, patch: Partial<Pick<ProjectFile, "title" | "scene" | "assets" | "thumbnail" | "kind">>): Promise<ProjectFile> {
  const p = await readProject(id);
  if (!p) throw new Error("That project doesn't exist.");
  if (patch.title !== undefined) p.title = patch.title.slice(0, 100) || "Untitled project";
  if (patch.scene !== undefined) p.scene = patch.scene;
  if (patch.assets !== undefined) p.assets = toStored(patch.assets);
  if (patch.thumbnail !== undefined) p.thumbnail = patch.thumbnail;
  if (patch.kind !== undefined) p.kind = patch.kind;
  p.updatedAt = Date.now();
  await writeProject(p);
  if (patch.scene !== undefined) await autoVersion(p).catch(() => {});
  return p;
}

export async function deleteProject(id: string) {
  if (!validId(id)) throw new Error("Bad project id");
  await files.remove(`projects/${id}.json`);
  await files.removeDir(`versions/${id}`);
}

export async function duplicateProject(id: string): Promise<ProjectFile> {
  const p = await readProject(id);
  if (!p) throw new Error("That project doesn't exist.");
  const copy = await createProject({ title: `${p.title} (copy)`, scene: p.scene, assets: p.assets, kind: p.kind });
  if (p.thumbnail) await saveProject(copy.id, { thumbnail: p.thumbnail });
  return (await readProject(copy.id))!;
}

// ── Home page demo: the bundled sample is used on the phone ─────────

export async function getDemo(): Promise<Pick<ProjectFile, "title" | "scene" | "assets" | "kind"> | null> {
  return null;
}

export async function setDemo(_id: string): Promise<{ title: string }> {
  throw new Error("The sample project is bundled with the app.");
}

// ── Versions ────────────────────────────────────────────────────────

async function versionFiles(id: string): Promise<string[]> {
  return (await files.list(`versions/${id}`)).filter((f) => /^\d+_(auto|named)\.json$/.test(f)).sort();
}

async function autoVersion(p: ProjectFile) {
  const list = await versionFiles(p.id);
  const autos = list.filter((f) => f.includes("_auto"));
  const last = autos.length ? Number(autos[autos.length - 1].split("_")[0]) : 0;
  if (Date.now() - last < AUTO_EVERY_MS) return;
  await files.writeText(`versions/${p.id}/${Date.now()}_auto.json`, JSON.stringify({ label: null, scene: p.scene, assets: p.assets, title: p.title }));
  for (const old of autos.slice(0, Math.max(0, autos.length + 1 - MAX_AUTO_VERSIONS))) await files.remove(`versions/${p.id}/${old}`);
}

export async function listVersions(projectId: string): Promise<VersionSummary[]> {
  if (!validId(projectId)) return [];
  const out: VersionSummary[] = [];
  for (const f of (await versionFiles(projectId)).reverse()) {
    const [at, kind] = f.replace(".json", "").split("_");
    let label: string | null = null;
    if (kind === "named") {
      try {
        label = (JSON.parse((await files.readText(`versions/${projectId}/${f}`)) ?? "{}") as { label?: string }).label ?? null;
      } catch {
        label = null;
      }
    }
    out.push({ id: f.replace(".json", ""), at: Number(at), label, auto: kind === "auto" });
  }
  return out;
}

export async function addVersion(projectId: string, label: string): Promise<VersionSummary> {
  const p = await readProject(projectId);
  if (!p) throw new Error("That project doesn't exist.");
  const at = Date.now();
  await files.writeText(`versions/${projectId}/${at}_named.json`, JSON.stringify({ label: label.slice(0, 80), scene: p.scene, assets: p.assets, title: p.title }));
  return { id: `${at}_named`, at, label, auto: false };
}

export async function getVersion(projectId: string, versionId: string): Promise<{ scene: unknown; assets: unknown[]; title: string } | null> {
  if (!validId(projectId) || !/^\d+_(auto|named)$/.test(versionId)) return null;
  const text = await files.readText(`versions/${projectId}/${versionId}.json`);
  if (!text) return null;
  try {
    const v = JSON.parse(text) as { scene: unknown; assets: unknown[]; title: string };
    return { ...v, assets: await toLive(v.assets ?? []) };
  } catch {
    return null;
  }
}
