export interface ImportIdentityDocument {
  readonly documentId: string;
  readonly currentVersionId: string;
  readonly title: string;
  readonly fileName: string;
  readonly contentHash: string;
  readonly normalizedTitle: string;
  readonly normalizedFileName: string;
}

export interface ImportIdentityInput {
  readonly contentHash: string;
  readonly title: string;
  readonly fileName: string;
}

export interface ImportIdentityDecision {
  readonly exactDuplicates: readonly ImportIdentityDocument[];
  readonly possibleUpdates: readonly ImportIdentityDocument[];
}

/** Normalizes only identity metadata; document contents never enter this policy. */
export function normalizeIdentityText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

export function normalizeIdentityFileName(value: string): string {
  return normalizeIdentityText(value).replace(/\.md$/iu, "");
}

export function decideImportIdentity(
  input: ImportIdentityInput,
  documents: readonly ImportIdentityDocument[],
): ImportIdentityDecision {
  const normalizedTitle = normalizeIdentityText(input.title);
  const normalizedFileName = normalizeIdentityFileName(input.fileName);
  const exactDuplicates = documents.filter((document) => document.contentHash === input.contentHash);
  const exactIds = new Set(exactDuplicates.map((document) => document.documentId));
  const possibleUpdates = documents.filter((document) =>
    !exactIds.has(document.documentId)
    && (document.normalizedTitle === normalizedTitle || document.normalizedFileName === normalizedFileName),
  );
  return { exactDuplicates, possibleUpdates };
}
