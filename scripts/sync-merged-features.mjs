import { writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadFeatures, validateFeatures } from "./features.mjs";

const shaPattern = /^[0-9a-f]{40}$/i;

export function pullNumber(url, repository) {
  const prefix = `https://github.com/${repository}/pull/`;
  if (typeof url !== "string" || !url.startsWith(prefix)) return null;
  const suffix = url.slice(prefix.length);
  const number = Number(suffix);
  return /^[1-9]\d*$/.test(suffix) && Number.isSafeInteger(number) ? number : null;
}

export async function collectMergedUpdates(records, { repository, getPullRequest, pullContainsFile }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? "")) throw new Error("GITHUB_REPOSITORY inválido");
  const updates = [];

  for (const record of records) {
    if (record.data.status !== "done") continue;
    const number = pullNumber(record.data.pr, repository);
    if (number === null) continue;

    const pr = await getPullRequest(number);
    if (pr?.number !== number || !pr.base || typeof pr.base.ref !== "string" || typeof pr.base.repo?.full_name !== "string" || typeof pr.head?.ref !== "string" || typeof pr.head.repo?.full_name !== "string") {
      throw new Error(`Respuesta inválida de GitHub para PR #${number}`);
    }
    if (!pr.merged_at || pr.base.ref !== "main" || pr.base.repo.full_name !== repository) continue;
    if (pr.head.ref !== record.data.branch || pr.head.repo.full_name !== repository) continue;
    const featurePath = `docs/engineering/features/${basename(record.file)}`;
    if (!await pullContainsFile(number, featurePath)) continue;
    if (!shaPattern.test(pr.merge_commit_sha ?? "") || !Number.isFinite(Date.parse(pr.merged_at))) {
      throw new Error(`Evidencia de merge inválida para PR #${number}`);
    }

    const evidence = `PR #${number} fusionada a main el ${pr.merged_at}; merge commit ${pr.merge_commit_sha}.`;
    updates.push({
      file: record.file,
      data: { ...record.data, status: "merged", evidence: record.data.evidence.includes(evidence) ? record.data.evidence : [...record.data.evidence, evidence] },
      number,
    });
  }
  return updates;
}

async function requestGitHubJson(path, { repository, token, fetchImpl = fetch }) {
  const response = await fetchImpl(`https://api.github.com/repos/${repository}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "price-radar-feature-status",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error(`GitHub API devolvió HTTP ${response.status} para ${path}`);
  return response.json();
}

export async function getPullRequestFromGitHub(number, options) {
  return requestGitHubJson(`/pulls/${number}`, options);
}

export async function pullContainsFileFromGitHub(number, featurePath, options) {
  for (let page = 1; page <= 30; page += 1) {
    const files = await requestGitHubJson(`/pulls/${number}/files?per_page=100&page=${page}`, options);
    if (!Array.isArray(files) || files.some((file) => typeof file.filename !== "string")) {
      throw new Error(`Lista de archivos inválida para PR #${number}`);
    }
    if (files.some((file) => file.filename === featurePath)) return true;
    if (files.length < 100) return false;
  }
  throw new Error(`PR #${number} supera el límite de archivos verificables de GitHub`);
}

export async function syncMergedFeatures({ repository, token, directory, fetchImpl = fetch }) {
  if (!token) throw new Error("GITHUB_TOKEN no configurado");
  const records = loadFeatures(directory);
  const baselineErrors = validateFeatures(records);
  if (baselineErrors.length) throw new Error(`Registro inválido antes de sincronizar:\n${baselineErrors.join("\n")}`);

  const updates = await collectMergedUpdates(records, {
    repository,
    getPullRequest: (number) => getPullRequestFromGitHub(number, { repository, token, fetchImpl }),
    pullContainsFile: (number, featurePath) => pullContainsFileFromGitHub(number, featurePath, { repository, token, fetchImpl }),
  });
  const changedByFile = new Map(updates.map(({ file, data }) => [file, data]));
  const updatedRecords = records.map(({ file, data }) => ({ file, data: changedByFile.get(file) ?? data }));
  const errors = validateFeatures(updatedRecords);
  if (errors.length) throw new Error(`Registro inválido después de sincronizar:\n${errors.join("\n")}`);

  for (const { file, data } of updates) writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  return updates.map(({ number }) => number);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const updated = await syncMergedFeatures({ repository: process.env.GITHUB_REPOSITORY, token: process.env.GITHUB_TOKEN });
    console.log(updated.length ? `Features sincronizados: ${updated.map((number) => `PR #${number}`).join(", ")}` : "Sin features done con merge confirmado a main.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
