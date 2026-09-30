import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { collectMergedUpdates, getPullRequestFromGitHub, pullContainsFileFromGitHub, pullNumber, syncMergedFeatures } from "./sync-merged-features.mjs";

const repository = "camilocas88/price-radar";
const sha = "a".repeat(40);
const record = (status, pr = `https://github.com/${repository}/pull/7`) => ({
  file: "/tmp/F-004.json",
  data: { status, pr, branch: "feature/t-004-source-access", evidence: ["npm run lint: correcto."] },
});
const mergedPr = (base = "main") => ({
  number: 7,
  merged_at: "2026-09-30T01:05:33Z",
  merge_commit_sha: sha,
  base: { ref: base, repo: { full_name: repository } },
  head: { ref: "feature/t-004-source-access", repo: { full_name: repository } },
});
const collect = (records, pr = mergedPr(), containsFile = true) => collectMergedUpdates(records, {
  repository,
  getPullRequest: async () => pr,
  pullContainsFile: async (number, path) => number === 7 && path === "docs/engineering/features/F-004.json" && containsFile,
});

test("solo acepta URL exacta de PR del repositorio", () => {
  assert.equal(pullNumber(`https://github.com/${repository}/pull/7`, repository), 7);
  assert.equal(pullNumber("https://github.com/otro/repo/pull/7", repository), null);
  assert.equal(pullNumber(`https://github.com/${repository}/pull/7/extra`, repository), null);
});

test("done pasa a merged con evidencia cuando la PR se fusionó a main", async () => {
  const [update] = await collect([record("done")]);
  assert.equal(update.data.status, "merged");
  assert.match(update.data.evidence.at(-1), /PR #7 fusionada a main.*merge commit/);
  assert.equal(update.data.evidence.length, 2);
});

test("una PR fusionada a otra rama no se confunde con un merge a main", async () => {
  assert.deepEqual(await collect([record("done")], mergedPr("feature/t-005-registry-maintenance")), []);
});

test("PR abierta, repo ajeno y estados distintos de done no se actualizan", async () => {
  assert.deepEqual(await collect([record("done")], { ...mergedPr(), merged_at: null }), []);
  assert.deepEqual(await collect([record("done")], { ...mergedPr(), base: { ref: "main", repo: { full_name: "otro/repo" } } }), []);
  assert.deepEqual(await collect([record("in_review"), record("merged")]), []);
  assert.deepEqual(await collect([record("done", "https://github.com/otro/repo/pull/7")]), []);
});

test("PR ajena del mismo repo, rama distinta o archivo ausente no se atribuyen al feature", async () => {
  assert.deepEqual(await collect([record("done")], { ...mergedPr(), head: { ref: "feature/t-999-other", repo: { full_name: repository } } }), []);
  assert.deepEqual(await collect([record("done")], { ...mergedPr(), head: { ref: "feature/t-004-source-access", repo: { full_name: "otro/repo" } } }), []);
  assert.deepEqual(await collect([record("done")], mergedPr(), false), []);
});

test("la sincronización repetida es idempotente", async () => {
  const [update] = await collect([record("done")]);
  assert.deepEqual(await collect([{ file: update.file, data: update.data }]), []);
});

test("una respuesta API inválida falla sin marcar merged", async () => {
  await assert.rejects(collect([record("done")], { ...mergedPr(), number: 8 }), /Respuesta inválida/);
  await assert.rejects(collect([record("done")], { ...mergedPr(), merge_commit_sha: null }), /Evidencia de merge inválida/);
});

test("un HTTP fallido de GitHub falla sin exponer el token", async () => {
  await assert.rejects(getPullRequestFromGitHub(7, {
    repository,
    token: "secreto-de-prueba",
    fetchImpl: async () => ({ ok: false, status: 403 }),
  }), (error) => error.message.includes("HTTP 403") && !error.message.includes("secreto-de-prueba"));
});

test("busca el archivo exacto en páginas sucesivas de la PR", async () => {
  const calls = [];
  const found = await pullContainsFileFromGitHub(7, "docs/engineering/features/F-004.json", {
    repository,
    token: "secreto-de-prueba",
    fetchImpl: async (url) => {
      calls.push(url);
      return { ok: true, json: async () => new URL(url).searchParams.get("page") === "1"
        ? Array.from({ length: 100 }, (_, index) => ({ filename: `src/other-${index}.ts` }))
        : [{ filename: "docs/engineering/features/F-004.json" }] };
    },
  });
  assert.equal(found, true);
  assert.equal(calls.length, 2);
});

test("actualiza F-004 en disco e ignora una segunda ejecución", async () => {
  const directory = mkdtempSync(join(tmpdir(), "price-radar-status-"));
  const source = resolve(dirname(fileURLToPath(import.meta.url)), "../docs/engineering/features");
  try {
    for (const name of readdirSync(source).filter((name) => /^F-\d{3}\.json$/.test(name))) {
      cpSync(join(source, name), join(directory, name));
      const file = join(directory, name);
      const fixture = JSON.parse(readFileSync(file, "utf8"));
      if (name === "F-004.json") fixture.status = "done";
      else if (fixture.status === "done") fixture.status = "merged";
      writeFileSync(file, `${JSON.stringify(fixture, null, 2)}\n`);
    }
    const options = {
      repository,
      token: "secreto-de-prueba",
      directory,
      fetchImpl: async (url) => ({ ok: true, json: async () => url.includes("/files?")
        ? [{ filename: "docs/engineering/features/F-004.json" }]
        : new URL(url).pathname.endsWith("/pulls/8")
          ? { ...mergedPr(), number: 8, merged_at: null }
          : mergedPr() }),
    };
    assert.deepEqual(await syncMergedFeatures(options), [7]);
    const updated = JSON.parse(readFileSync(join(directory, "F-004.json"), "utf8"));
    assert.equal(updated.status, "merged");
    assert.deepEqual(await syncMergedFeatures(options), []);
  } finally {
    rmSync(directory, { recursive: true });
  }
});
