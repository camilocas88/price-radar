import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const featuresDir = join(projectRoot, "docs/engineering/features");
const statuses = new Set(["pending", "in_progress", "blocked", "in_review", "done", "merged"]);
const activeStatuses = new Set(["in_progress", "blocked", "in_review", "done"]);
const requiredStrings = ["name", "title", "description", "plan", "roadmap_note"];
const requiredArrays = ["acceptance", "depends_on", "allowed_modules", "evidence"];

export function loadFeatures(directory = featuresDir) {
  return readdirSync(directory)
    .filter((name) => /^F-\d{3}\.json$/.test(name))
    .sort()
    .map((name) => ({ file: join(directory, name), data: JSON.parse(readFileSync(join(directory, name), "utf8")) }));
}

export function validateFeatures(records, root = projectRoot) {
  const errors = [];
  const ids = new Set();
  const names = new Set();
  const ownersByModule = new Map();

  for (const { file, data } of records) {
    const label = relative(root, file);
    if (!Number.isInteger(data.id) || data.id < 1) errors.push(`${label}: id debe ser un entero positivo`);
    if (Number.isInteger(data.id) && file.split("/").at(-1) !== `F-${String(data.id).padStart(3, "0")}.json`) errors.push(`${label}: nombre de archivo e id no coinciden`);
    if (ids.has(data.id)) errors.push(`${label}: id duplicado ${data.id}`);
    ids.add(data.id);

    for (const key of requiredStrings) if (typeof data[key] !== "string" || !data[key].trim()) errors.push(`${label}: ${key} debe ser texto no vacío`);
    if (typeof data.name === "string" && !/^[a-z][a-z0-9_]*$/.test(data.name)) errors.push(`${label}: name debe usar snake_case`);
    if (names.has(data.name)) errors.push(`${label}: name duplicado ${data.name}`);
    names.add(data.name);
    for (const key of requiredArrays) if (!Array.isArray(data[key])) errors.push(`${label}: ${key} debe ser un arreglo`);
    if (!Array.isArray(data.acceptance) || data.acceptance.length === 0 || data.acceptance.some((item) => typeof item !== "string" || !item.trim())) errors.push(`${label}: acceptance requiere criterios de texto`);
    if (typeof data.sdd !== "boolean") errors.push(`${label}: sdd debe ser booleano`);
    if (!statuses.has(data.status)) errors.push(`${label}: status no válido: ${data.status}`);

    for (const key of ["owner", "ticket", "branch", "pr", "reviewed_by"]) {
      if (data[key] !== null && (typeof data[key] !== "string" || !data[key].trim())) errors.push(`${label}: ${key} debe ser texto no vacío o null`);
    }
    if (typeof data.plan === "string" && !existsSync(join(root, data.plan.split("#")[0]))) errors.push(`${label}: plan no existe: ${data.plan}`);
    if (data.ticket && !existsSync(join(root, data.ticket))) errors.push(`${label}: ticket no existe: ${data.ticket}`);
    if (data.pr && !/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/.test(data.pr)) errors.push(`${label}: pr debe enlazar una Pull Request`);

    if (data.status === "pending" && [data.owner, data.ticket, data.branch, data.pr, data.reviewed_by].some((value) => value !== null)) errors.push(`${label}: pending no puede estar reclamado`);
    if (activeStatuses.has(data.status)) {
      if (!data.owner || !data.ticket || !/^feature\/t-\d{3}-/.test(data.branch ?? "")) errors.push(`${label}: feature activo requiere owner, ticket y rama feature/t-###-*`);
      if (!Array.isArray(data.allowed_modules) || data.allowed_modules.length === 0) errors.push(`${label}: feature activo requiere allowed_modules`);
      for (const modulePath of Array.isArray(data.allowed_modules) ? data.allowed_modules : []) {
        if (typeof modulePath !== "string" || !modulePath.trim()) { errors.push(`${label}: allowed_modules contiene un valor inválido`); continue; }
        const previous = ownersByModule.get(modulePath);
        if (previous && previous !== data.id) errors.push(`${label}: módulo ${modulePath} ya está reclamado por F-${String(previous).padStart(3, "0")}`);
        ownersByModule.set(modulePath, data.id);
      }
    }
    if (["in_review", "done"].includes(data.status) && !data.pr) errors.push(`${label}: ${data.status} requiere PR`);
    if (data.status === "done" && (!data.reviewed_by || data.reviewed_by === data.owner)) errors.push(`${label}: done requiere revisión ajena`);
    if (["in_review", "done"].includes(data.status)) {
      for (const gate of ["npm run lint", "npm run typecheck", "npm test", "npm run build"]) {
        if (!Array.isArray(data.evidence) || !data.evidence.some((item) => typeof item === "string" && item.includes(gate))) errors.push(`${label}: ${data.status} requiere evidencia de ${gate}`);
      }
    }
    if (Array.isArray(data.depends_on) && (new Set(data.depends_on).size !== data.depends_on.length || data.depends_on.some((id) => !Number.isInteger(id) || id < 1 || id === data.id))) errors.push(`${label}: depends_on contiene ids duplicados o inválidos`);
  }

  const byId = new Map(records.map(({ data }) => [data.id, data]));
  for (const { file, data } of records) {
    for (const dependency of Array.isArray(data.depends_on) ? data.depends_on : []) if (!byId.has(dependency)) errors.push(`${relative(root, file)}: dependencia F-${String(dependency).padStart(3, "0")} no existe`);
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) { errors.push(`dependencia circular en F-${String(id).padStart(3, "0")}`); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.depends_on ?? []) if (byId.has(dependency)) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of byId.keys()) visit(id);
  return errors;
}

export function formatFeatureList(records) {
  const rows = records.map(({ data }) => [
    `F-${String(data.id).padStart(3, "0")}`,
    data.status,
    data.owner ?? "—",
    data.ticket?.split("/").at(-1)?.replace(/\.md$/, "") ?? "—",
    data.pr ? `PR #${data.pr.split("/").at(-1)}` : "—",
    data.title,
  ]);
  const headers = ["ID", "ESTADO", "DUEÑO", "TICKET", "PR", "FEATURE"];
  const widths = headers.map((header, index) => Math.max(header.length, ...rows.map((row) => row[index].length)));
  return [headers, ...rows].map((row) => row.map((value, index) => value.padEnd(widths[index])).join("  ").trimEnd()).join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  if (!["list", "check"].includes(command)) {
    console.error("Uso: node scripts/features.mjs <list|check> [--json]");
    process.exitCode = 2;
  } else {
    try {
      const records = loadFeatures();
      const errors = validateFeatures(records);
      if (errors.length) {
        for (const error of errors) console.error(error);
        process.exitCode = 1;
      } else if (command === "check") {
        console.log(`${records.length} features validados`);
      } else if (process.argv.includes("--json")) {
        console.log(JSON.stringify(records.map(({ data }) => data), null, 2));
      } else {
        console.log(formatFeatureList(records));
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
