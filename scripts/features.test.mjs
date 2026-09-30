import assert from "node:assert/strict";
import { test } from "node:test";
import { formatFeatureList, loadFeatures, validateFeatures } from "./features.mjs";

const base = {
  id: 1, name: "example_feature", title: "Ejemplo", description: "Descripción", plan: "README.md",
  acceptance: ["Se cumple un criterio."], sdd: true, status: "pending", roadmap_note: "Roadmap",
  owner: null, ticket: null, branch: null, pr: null, depends_on: [], allowed_modules: [],
  reviewed_by: null, evidence: [],
};
const record = (data, number = data.id) => ({ file: `/tmp/F-${String(number).padStart(3, "0")}.json`, data });

test("el backlog real es válido y se puede listar", () => {
  const records = loadFeatures();
  assert.deepEqual(validateFeatures(records), []);
  const list = formatFeatureList(records);
  for (const { data } of records) {
    const id = `F-${String(data.id).padStart(3, "0")}`;
    assert.match(list, new RegExp(`^${id}\\s+${data.status}\\b`, "m"));
  }
});

test("rechaza dependencias ausentes y circulares", () => {
  const missing = validateFeatures([record({ ...base, depends_on: [2] })]);
  assert.ok(missing.some((error) => error.includes("no existe")));
  const other = { ...base, id: 2, name: "other_feature", depends_on: [1] };
  const cyclic = validateFeatures([record({ ...base, depends_on: [2] }), record(other)]);
  assert.ok(cyclic.some((error) => error.includes("circular")));
});

test("done exige PR y revisión ajena", () => {
  const active = { ...base, status: "done", owner: "Codex", ticket: "README.md", branch: "feature/t-003-example", allowed_modules: ["src/example.ts"] };
  const errors = validateFeatures([record(active)]);
  assert.ok(errors.some((error) => error.includes("requiere PR")));
  assert.ok(errors.some((error) => error.includes("requiere revisión ajena")));
});

test("impide que dos features activos reclamen el mismo módulo", () => {
  const claimed = { ...base, status: "in_progress", owner: "Codex", ticket: "README.md", branch: "feature/t-003-one", pr: "https://github.com/example/project/pull/1", allowed_modules: ["src/example.ts"] };
  const second = { ...claimed, id: 2, name: "second_feature", branch: "feature/t-004-two" };
  const errors = validateFeatures([record(claimed), record(second)]);
  assert.ok(errors.some((error) => error.includes("ya está reclamado")));
});

test("rechaza rutas ambiguas y directorios en módulos asignados", () => {
  const claimed = { ...base, status: "claiming", owner: "Codex", ticket: "README.md", branch: "feature/t-003-one", allowed_modules: ["src/example.ts"] };
  const relativeAlias = { ...claimed, id: 2, name: "second_feature", branch: "feature/t-004-two", allowed_modules: ["./src/example.ts"] };
  const aliases = validateFeatures([record(claimed), record(relativeAlias)]);
  assert.ok(aliases.some((error) => error.includes("no canónica")));
  const directory = validateFeatures([record({ ...claimed, allowed_modules: ["src"] })]);
  assert.ok(directory.some((error) => error.includes("no directorios")));
});

test("in_progress exige PR y merged nuevo no omite revisión ni gates", () => {
  const claimed = { ...base, status: "in_progress", owner: "Codex", ticket: "README.md", branch: "feature/t-003-one", allowed_modules: ["src/example.ts"] };
  assert.ok(validateFeatures([record(claimed)]).some((error) => error.includes("in_progress requiere PR")));
  const merged = { ...claimed, id: 3, name: "merged_feature", status: "merged" };
  const errors = validateFeatures([record(merged)]);
  assert.ok(errors.some((error) => error.includes("merged requiere PR")));
  assert.ok(errors.some((error) => error.includes("merged requiere revisión ajena")));
  assert.ok(errors.some((error) => error.includes("merged requiere evidencia de npm run lint")));
});
