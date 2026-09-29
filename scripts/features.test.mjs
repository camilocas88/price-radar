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
  assert.match(formatFeatureList(records), /F-004\s+pending/);
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
  const claimed = { ...base, status: "in_progress", owner: "Codex", ticket: "README.md", branch: "feature/t-003-one", allowed_modules: ["src/example.ts"] };
  const second = { ...claimed, id: 2, name: "second_feature", branch: "feature/t-004-two" };
  const errors = validateFeatures([record(claimed), record(second)]);
  assert.ok(errors.some((error) => error.includes("ya está reclamado")));
});
