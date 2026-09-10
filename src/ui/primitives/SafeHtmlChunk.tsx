import type { SanitizedHtml } from "@/application/ports/document-repository";

interface SafeHtmlChunkProps {
  readonly html: SanitizedHtml;
  readonly ordinal: number;
}

/** The sole HTML injection boundary; its input can only originate in the validated repository. */
export function SafeHtmlChunk({ html, ordinal }: SafeHtmlChunkProps) {
  return <div className="reader-content reader-chunk__content" data-reader-ordinal={ordinal} dangerouslySetInnerHTML={{ __html: html.value }} />;
}
