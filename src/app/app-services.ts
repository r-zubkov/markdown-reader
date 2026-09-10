import type { DocumentRepository, RepositoryResult } from "@/application/ports/document-repository";
import { DexieDocumentRepository } from "@/infrastructure/db/document-repository";

const repository = new DexieDocumentRepository();

export function getDocumentRepository(): DocumentRepository { return repository; }

/** Startup recovery is deliberately scoped to abandoned staging records only. */
export async function initializeRepository(now = Date.now()): Promise<RepositoryResult<void>> {
  return repository.cleanupAbandonedStaging({ olderThan: now - 24 * 60 * 60 * 1000 });
}
