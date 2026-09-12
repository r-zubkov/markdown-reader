import { useRef, type DragEvent } from "react";
import { FileTextIcon, UploadIcon } from "lucide-react";

import { Button } from "./button";

interface FileDropFieldProps {
  accept: string;
  autoFocusButton?: boolean;
  buttonLabel: string;
  description: string;
  inputTestId?: string;
  label: string;
  onFileSelected: (file: File) => void;
  onFilesSelected?: (files: readonly File[]) => void;
  selectedFileName?: string | undefined;
  selectedLabel: string;
}

export function FileDropField({
  accept,
  autoFocusButton = false,
  buttonLabel,
  description,
  inputTestId,
  label,
  onFileSelected,
  onFilesSelected,
  selectedFileName,
  selectedLabel,
}: FileDropFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function selectFiles(files: FileList | null) {
    const selection = files === null ? [] : Array.from(files);
    if (onFilesSelected !== undefined) {
      onFilesSelected(selection);
      return;
    }
    const file = selection[0];
    if (file !== undefined) onFileSelected(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    selectFiles(event.dataTransfer.files);
  }

  return (
    <div
      aria-label={label}
      className="mobile-platform-spike__drop-zone"
      data-file-selected={selectedFileName ? "true" : "false"}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={handleDrop}
    >
      <UploadIcon aria-hidden="true" />
      <p>{description}</p>
      <input
        accept={accept}
        className="mobile-platform-spike__visually-hidden"
        data-testid={inputTestId}
        onChange={(event) => {
          selectFiles(event.currentTarget.files);
        }}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />
      <Button
        autoFocus={autoFocusButton}
        onPress={() => {
          inputRef.current?.click();
        }}
        variant="outline"
      >
        {buttonLabel}
      </Button>
      {selectedFileName ? (
        <p aria-live="polite" className="mobile-platform-spike__selected-file">
          <FileTextIcon aria-hidden="true" /> {selectedLabel}: {selectedFileName}
        </p>
      ) : null}
    </div>
  );
}
