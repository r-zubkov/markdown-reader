import type {
  OutlineItem,
  PersistablePipelineChunk,
  SectionLayout,
  SplitStrategy,
} from "@/domain/content/pipeline-types";

export type RepositoryErrorCode =
  | "DB_UNAVAILABLE"
  | "MIGRATION_FAILED"
  | "STALE_DERIVED"
  | "QUOTA_EXCEEDED"
  | "COMMIT_CONFLICT"
  | "DOCUMENT_NOT_FOUND"
  | "INVALID_PERSISTED_RECORD"
  | "UNKNOWN_STORAGE_ERROR";

export type RepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: RepositoryErrorCode } };

export interface DocumentSummary {
  readonly documentId: string;
  readonly currentVersionId: string;
  readonly title: string;
  readonly fileName: string;
  readonly activityAt: number;
  readonly chunkCount: number;
  readonly contentHash: string;
}

export interface StageDocumentVersionInput {
  readonly documentId: string;
  readonly versionId: string;
  readonly jobId: string;
  readonly fileName: string;
  readonly normalizedFileName: string;
  readonly title: string;
  readonly normalizedTitle: string;
  readonly contentHash: string;
  readonly byteLength: number;
  readonly charLength: number;
  readonly sourceBlob: Blob;
  readonly outline: readonly OutlineItem[];
  readonly layouts: Record<SplitStrategy, SectionLayout>;
  readonly chunkCount: number;
  readonly pipelineVersion: number;
  readonly importedAt: number;
  readonly expectedCurrentVersionId?: string;
}

export interface SanitizedHtml {
  readonly value: string;
  readonly pipelineVersion: number;
}

export interface ReaderStateSnapshot {
  readonly documentId: string;
  readonly readingMode: "continuous" | "sections";
  readonly modeOrigin: "auto" | "user";
  readonly splitStrategy: SplitStrategy;
  readonly progressRatio: number;
  readonly updatedAt: number;
}

export interface AppPreferencesSnapshot {
  readonly theme: "system" | "light" | "dark";
  readonly remoteImagesEnabled: boolean;
  readonly desktopTocCollapsed: boolean;
  readonly updatedAt: number;
}

export interface DocumentRepository {
  stageVersion(input: StageDocumentVersionInput): Promise<RepositoryResult<void>>;
  appendChunkBatch(input: {
    readonly versionId: string;
    readonly jobId: string;
    readonly batchOrdinal: number;
    readonly chunks: readonly PersistablePipelineChunk[];
  }): Promise<RepositoryResult<void>>;
  commitVersion(input: {
    readonly versionId: string;
    readonly jobId: string;
    readonly readyAt: number;
  }): Promise<RepositoryResult<{ readonly documentId: string; readonly versionId: string }>>;
  abortVersion(jobId: string): Promise<RepositoryResult<void>>;
  cleanupAbandonedStaging(input: {
    readonly olderThan: number;
    readonly activeJobIds?: ReadonlySet<string>;
  }): Promise<RepositoryResult<void>>;
  listDocuments(): Promise<RepositoryResult<readonly DocumentSummary[]>>;
  observeDocuments(listener: (result: RepositoryResult<readonly DocumentSummary[]>) => void): () => void;
  getCurrentChunkWindow(input: {
    readonly documentId: string;
    readonly startOrdinal: number;
    readonly endOrdinalInclusive: number;
    readonly pipelineVersion: number;
  }): Promise<RepositoryResult<readonly SanitizedHtml[]>>;
  getReaderState(documentId: string): Promise<RepositoryResult<ReaderStateSnapshot | undefined>>;
  getPreferences(): Promise<RepositoryResult<AppPreferencesSnapshot>>;
  saveTheme(theme: AppPreferencesSnapshot["theme"], updatedAt: number): Promise<RepositoryResult<void>>;
}
