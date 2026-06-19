#!/usr/bin/env node
/* global fetch, process */

import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const _GITHUB_API_BASE_URL = "https://api.github.com";
const _GHCR_BASE_URL = "https://ghcr.io";
const _PER_PAGE = 100;
const _COPY_RETRY_COUNT = 3;
const _TAG_RETRY_COUNT = 3;
const _COPY_RETRY_DELAY_MS = 5_000;
const _TAG_RETRY_DELAY_MS = 2_000;
const _DEFAULT_MAX_RUNTIME_MS = 5 * 60 * 60 * 1000;

await main();

async function main() {
  const config = loadConfig(process.env);
  mkdirSync(config.workDirectory, { recursive: true });

  log(`Downloading source DB artifact from ${config.sourceDbArtifactUrl}`);
  const dbPath = await downloadArtifactDatabase(config);
  log(`Using source DB ${dbPath}`);

  const database = new Database(dbPath, { readonly: true });
  try {
    const sourcePackage = loadLatestSourcePackage(database);
    const manifestEntries = loadManifestEntries(database, sourcePackage.scanId);
    if (manifestEntries.length === 0) {
      throw new Error("source DB did not contain any manifests to copy");
    }

    log(
      `Loaded ${manifestEntries.length} manifests from ${sourcePackage.owner}/${sourcePackage.packageName} ` +
        `(scan ${sourcePackage.scanId})`
    );

    const destinationVersions = await loadDestinationVersionPage(config.githubToken, config.targetOwner, config.targetPackage);
    const startIndex = inferStartIndex(manifestEntries, destinationVersions);
    if (startIndex >= manifestEntries.length) {
      log("Destination frontier already covers all source manifests. Nothing to copy.");
      return;
    }

    log(`Resuming at source manifest ${startIndex + 1}/${manifestEntries.length}: ${manifestEntries[startIndex].digest}`);

    let registryToken = await loadRegistryPushToken(config.registryUsername, config.githubToken, config.targetOwner, config.targetPackage);
    const startedAt = Date.now();
    let copiedCount = 0;

    for (let index = startIndex; index < manifestEntries.length; index += 1) {
      const entry = manifestEntries[index];
      log(
        `Copying ${index + 1}/${manifestEntries.length} ${entry.digest} ` +
          `(${entry.tags.length} tag${entry.tags.length === 1 ? "" : "s"})`
      );

      const copyResult = await retry(`copy ${entry.digest}`, _COPY_RETRY_COUNT, _COPY_RETRY_DELAY_MS, async () =>
        copyManifest(
          config.craneBin,
          config.registryUsername,
          config.githubToken,
          registryToken,
          sourcePackage.owner,
          sourcePackage.packageName,
          config.targetOwner,
          config.targetPackage,
          entry.digest,
          entry.mediaType,
          entry.rawManifestJson
        )
      );
      registryToken = copyResult.registryToken;

      if (!copyResult.copied) {
        log(`Skipping tags for ${entry.digest} because the manifest could not be copied to the destination registry`);
        copiedCount += 1;
        if (config.copyDelayMs > 0) {
          await sleep(config.copyDelayMs);
        }
        if (Date.now() - startedAt >= config.maxRuntimeMs) {
          log(`Reached runtime limit after ${copiedCount} manifest(s). Stopping cleanly.`);
          return;
        }
        continue;
      }

      for (const tag of entry.tags) {
        await retry(`tag ${entry.digest} as ${tag}`, _TAG_RETRY_COUNT, _TAG_RETRY_DELAY_MS, async () => {
          registryToken = await putTag(
            config.registryUsername,
            config.githubToken,
            registryToken,
            config.targetOwner,
            config.targetPackage,
            tag,
            entry.mediaType,
            entry.rawManifestJson
          );
        });
      }

      copiedCount += 1;
      if (config.copyDelayMs > 0) {
        await sleep(config.copyDelayMs);
      }

      if (Date.now() - startedAt >= config.maxRuntimeMs) {
        log(`Reached runtime limit after ${copiedCount} manifest(s). Stopping cleanly.`);
        return;
      }
    }

    log(`Completed copy of ${copiedCount} manifest(s).`);
  } finally {
    database.close();
  }
}

function loadConfig(env) {
  const workDirectory = env.WORK_DIR || path.join(env.RUNNER_TEMP || tmpdir(), "ghcr-manager", "whale-copy");
  return {
    craneBin: env.CRANE_BIN || "crane",
    copyDelayMs: Number.parseInt(env.COPY_DELAY_SECONDS || "0", 10) * 1000,
    githubToken: requireEnv(env, "GITHUB_TOKEN"),
    maxRuntimeMs: Number.parseInt(env.MAX_RUNTIME_MINUTES || "300", 10) * 60 * 1000 || _DEFAULT_MAX_RUNTIME_MS,
    registryUsername: requireEnv(env, "REGISTRY_USERNAME"),
    sourceDbArtifactUrl: requireEnv(env, "SOURCE_DB_ARTIFACT_URL"),
    targetOwner: requireEnv(env, "TARGET_OWNER"),
    targetPackage: requireEnv(env, "TARGET_PACKAGE"),
    workDirectory
  };
}

function loadLatestSourcePackage(database) {
  const row = database
    .prepare(
      `
        SELECT scan_id, owner, package_name
        FROM v_latest_scan_per_package
        ORDER BY scan_completed_at DESC, scan_id DESC
        LIMIT 1
      `
    )
    .get();
  if (!row) {
    throw new Error("source DB did not contain a completed latest scan");
  }

  return {
    owner: row.owner,
    packageName: row.package_name,
    scanId: row.scan_id
  };
}

function loadManifestEntries(database, scanId) {
  const manifestRows = database
    .prepare(
      `
        SELECT
          pv.version_id AS version_id,
          pv.created_at AS created_at,
          m.digest AS digest,
          m.media_type AS media_type,
          mp.raw_json AS raw_json
        FROM package_versions pv
        JOIN manifests m
          ON m.scan_id = pv.scan_id
         AND m.version_id = pv.version_id
        JOIN manifest_payloads mp
          ON mp.scan_id = m.scan_id
         AND mp.digest = m.digest
        WHERE pv.scan_id = ?
        ORDER BY pv.created_at ASC, pv.version_id ASC
      `
    )
    .all(scanId);

  const tagsByVersionId = new Map();
  for (const row of database
    .prepare(
      `
        SELECT version_id, tag
        FROM tags
        WHERE scan_id = ?
        ORDER BY version_id ASC, tag ASC
      `
    )
    .all(scanId)) {
    const tags = tagsByVersionId.get(row.version_id) || [];
    tags.push(row.tag);
    tagsByVersionId.set(row.version_id, tags);
  }

  return manifestRows.map((row) => ({
    createdAt: row.created_at,
    digest: row.digest,
    mediaType: row.media_type,
    rawManifestJson: row.raw_json,
    tags: tagsByVersionId.get(row.version_id) || [],
    versionId: row.version_id
  }));
}

function inferStartIndex(manifestEntries, destinationVersions) {
  if (destinationVersions.length === 0) {
    return 0;
  }

  const sourceIndexByDigest = new Map(manifestEntries.map((entry, index) => [entry.digest, index]));
  let maxIndex = -1;
  for (const version of destinationVersions) {
    const index = sourceIndexByDigest.get(version.digest);
    if (index !== undefined && index > maxIndex) {
      maxIndex = index;
    }
  }

  return maxIndex + 1;
}

async function copyManifest(
  craneBin,
  registryUsername,
  githubToken,
  currentRegistryToken,
  sourceOwner,
  sourcePackage,
  targetOwner,
  targetPackage,
  digest,
  mediaType,
  manifestJson
) {
  try {
    runCraneCopy(craneBin, sourceOwner, sourcePackage, targetOwner, targetPackage, digest);
    return {
      copied: true,
      registryToken: currentRegistryToken
    };
  } catch (error) {
    if (!isMissingReferencedManifestError(error)) {
      throw error;
    }

    log(`Falling back to raw manifest PUT for ${digest} because crane hit MANIFEST_UNKNOWN on a referenced manifest`);
    try {
      return {
        copied: true,
        registryToken: await putManifestByDigest(
          registryUsername,
          githubToken,
          currentRegistryToken,
          targetOwner,
          targetPackage,
          digest,
          mediaType,
          manifestJson
        )
      };
    } catch (fallbackError) {
      if (!isRejectedBrokenManifestCopyError(fallbackError)) {
        throw fallbackError;
      }

      log(`Skipping uncopyable broken manifest ${digest} because GHCR rejected the raw manifest PUT`);
      return {
        copied: false,
        registryToken: currentRegistryToken
      };
    }
  }
}

function runCraneCopy(craneBin, sourceOwner, sourcePackage, targetOwner, targetPackage, digest) {
  const sourceRef = `ghcr.io/${sourceOwner}/${sourcePackage}@${digest}`;
  const targetRef = `ghcr.io/${targetOwner}/${targetPackage}@${digest}`;
  execFileSync(craneBin, ["copy", sourceRef, targetRef], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

async function putManifestByDigest(
  registryUsername,
  githubToken,
  currentRegistryToken,
  owner,
  packageName,
  digest,
  mediaType,
  manifestJson
) {
  let registryToken = currentRegistryToken;
  let response = await fetch(buildManifestPutUrl(owner, packageName, digest), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${registryToken}`,
      "Content-Type": mediaType,
      "User-Agent": "ghcr-manager"
    },
    body: manifestJson
  });

  if (response.status === 401) {
    registryToken = await loadRegistryPushToken(registryUsername, githubToken, owner, packageName);
    response = await fetch(buildManifestPutUrl(owner, packageName, digest), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${registryToken}`,
        "Content-Type": mediaType,
        "User-Agent": "ghcr-manager"
      },
      body: manifestJson
    });
  }

  if (!response.ok) {
    throw new Error(`failed to put manifest ${digest}: ${await buildErrorMessage(response)}`);
  }

  log(`Pushed raw manifest ${digest}`);
  return registryToken;
}

async function putTag(
  registryUsername,
  githubToken,
  currentRegistryToken,
  owner,
  packageName,
  tag,
  mediaType,
  manifestJson
) {
  let registryToken = currentRegistryToken;
  let response = await fetch(buildManifestPutUrl(owner, packageName, tag), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${registryToken}`,
      "Content-Type": mediaType,
      "User-Agent": "ghcr-manager"
    },
    body: manifestJson
  });

  if (response.status === 401) {
    registryToken = await loadRegistryPushToken(registryUsername, githubToken, owner, packageName);
    response = await fetch(buildManifestPutUrl(owner, packageName, tag), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${registryToken}`,
        "Content-Type": mediaType,
        "User-Agent": "ghcr-manager"
      },
      body: manifestJson
    });
  }

  if (!response.ok) {
    throw new Error(`failed to put tag ${tag}: ${await buildErrorMessage(response)}`);
  }

  const manifestDigest = `sha256:${createHash("sha256").update(manifestJson).digest("hex")}`;
  log(`Tagged ${manifestDigest} as ${tag}`);
  return registryToken;
}

async function loadDestinationVersionPage(githubToken, owner, packageName) {
  const ownerPathSegment = await loadOwnerPathSegment(githubToken, owner);
  const url = new URL(
    `/${ownerPathSegment}/${encodeURIComponent(owner)}/packages/container/${encodeURIComponent(packageName)}/versions`,
    _GITHUB_API_BASE_URL
  );
  url.searchParams.set("per_page", String(_PER_PAGE));
  url.searchParams.set("page", "1");

  const response = await fetch(url.toString(), {
    headers: buildGitHubApiHeaders(githubToken)
  });

  if (response.status === 404) {
    log(`Destination package ${owner}/${packageName} does not exist yet. Starting from the beginning.`);
    return [];
  }

  if (!response.ok) {
    throw new Error(`failed to load destination package versions: ${await buildErrorMessage(response)}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("destination package-version response was not an array");
  }

  return payload
    .map((item) => ({
      digest: typeof item?.name === "string" ? item.name : undefined
    }))
    .filter((item) => item.digest);
}

async function loadOwnerPathSegment(githubToken, owner) {
  const url = new URL(`/users/${encodeURIComponent(owner)}`, _GITHUB_API_BASE_URL);
  const response = await fetch(url.toString(), {
    headers: buildGitHubApiHeaders(githubToken)
  });
  if (!response.ok) {
    throw new Error(`failed to resolve owner type for ${owner}: ${await buildErrorMessage(response)}`);
  }

  const payload = await response.json();
  if (payload?.type === "Organization") {
    return "orgs";
  }
  if (payload?.type === "User") {
    return "users";
  }

  throw new Error(`unsupported owner type for ${owner}: ${payload?.type ?? "<missing>"}`);
}

async function loadRegistryPushToken(registryUsername, githubToken, owner, packageName) {
  const url = new URL("/token", _GHCR_BASE_URL);
  url.searchParams.set("service", "ghcr.io");
  url.searchParams.set("scope", `repository:${owner}/${packageName}:pull,push`);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Basic ${Buffer.from(`${registryUsername}:${githubToken}`).toString("base64")}`,
      "User-Agent": "ghcr-manager"
    }
  });
  if (!response.ok) {
    throw new Error(`failed to load GHCR push token: ${await buildErrorMessage(response)}`);
  }

  const payload = await response.json();
  if (typeof payload?.token !== "string" || payload.token.length === 0) {
    throw new Error("GHCR token response did not include a token");
  }

  return payload.token;
}

async function downloadArtifactDatabase(config) {
  const artifact = parseArtifactUrl(config.sourceDbArtifactUrl);
  const artifactZipUrl = new URL(
    `/repos/${artifact.owner}/${artifact.repo}/actions/artifacts/${artifact.artifactId}/zip`,
    _GITHUB_API_BASE_URL
  );

  const response = await fetch(artifactZipUrl.toString(), {
    headers: buildGitHubApiHeaders(config.githubToken)
  });
  if (!response.ok) {
    throw new Error(`failed to download artifact zip: ${await buildErrorMessage(response)}`);
  }

  const zipPath = path.join(config.workDirectory, "source-db.zip");
  writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()));

  const extractDirectory = path.join(config.workDirectory, "source-db");
  mkdirSync(extractDirectory, { recursive: true });
  execFileSync("unzip", ["-o", zipPath, "-d", extractDirectory], { stdio: "inherit" });

  const databasePath = findFirstSqliteFile(extractDirectory);
  if (!databasePath) {
    throw new Error(`artifact ${config.sourceDbArtifactUrl} did not contain a .sqlite file`);
  }

  return databasePath;
}

function findFirstSqliteFile(directory) {
  for (const entry of readdirSync(directory)) {
    const entryPath = path.join(directory, entry);
    const stat = statSync(entryPath);
    if (stat.isDirectory()) {
      const nested = findFirstSqliteFile(entryPath);
      if (nested) {
        return nested;
      }
      continue;
    }

    if (entry.endsWith(".sqlite")) {
      return entryPath;
    }
  }

  return undefined;
}

function parseArtifactUrl(value) {
  const url = new URL(value);
  const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/actions\/runs\/\d+\/artifacts\/(\d+)(?:\/.*)?$/u);
  if (!match) {
    throw new Error(`unsupported artifact URL format: ${value}`);
  }

  return {
    artifactId: match[3],
    owner: match[1],
    repo: match[2]
  };
}

function buildManifestPutUrl(owner, packageName, tag) {
  return new URL(`/v2/${owner}/${packageName}/manifests/${encodeURIComponent(tag)}`, _GHCR_BASE_URL).toString();
}

function buildGitHubApiHeaders(githubToken) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${githubToken}`,
    "User-Agent": "ghcr-manager",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

async function retry(label, attempts, delayMs, operation) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) {
        break;
      }

      log(`${label} failed on attempt ${attempt}/${attempts}: ${errorMessage(error)}; retrying in ${delayMs}ms`);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

async function buildErrorMessage(response) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  const message =
    payload && typeof payload === "object" && typeof payload.message === "string" ? payload.message : "unknown error";
  return `status ${response.status} - ${message}`;
}

function requireEnv(env, key) {
  const value = env[key];
  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function isMissingReferencedManifestError(error) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = [error.message, error.stdout, error.stderr].filter((value) => typeof value === "string").join("\n");
  return message.includes("MANIFEST_UNKNOWN");
}

function isRejectedBrokenManifestCopyError(error) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("failed to put manifest") && error.message.includes("status 400");
}

function log(message) {
  process.stdout.write(`${new Date().toISOString()} ${message}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
