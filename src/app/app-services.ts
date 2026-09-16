import type { DocumentRepository, RepositoryResult } from "@/application/ports/document-repository";
import { DexieDocumentRepository } from "@/infrastructure/db/document-repository";

const repository = new DexieDocumentRepository();

export function getDocumentRepository(): DocumentRepository { return repository; }

/** Startup recovery retries only abandoned staging and non-current ready-version cleanup. */
export async function initializeRepository(now = Date.now()): Promise<RepositoryResult<void>> {
  const staging = await repository.cleanupAbandonedStaging({ olderThan: now - 24 * 60 * 60 * 1000 });
  if (!staging.ok) return staging;
  return repository.cleanupObsoleteReadyVersions();
}
