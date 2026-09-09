import { useRef, type DragEvent } from "react";
import { FileTextIcon, UploadIcon } from "lucide-react";

import { Button } from "./button";

interface FileDropFieldProps {
  accept: string;
  buttonLabel: string;
  description: string;
  inputTestId?: string;
  label: string;
  onFileSelected: (file: File) => void;
  selectedFileName?: string | undefined;
  selectedLabel: string;
}

export function FileDropField({
  accept,
  buttonLabel,
  description,
  inputTestId,
  label,
  onFileSelected,
  selectedFileName,
  selectedLabel,
}: FileDropFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function selectFirstFile(files: FileList | null) {
    const file = files?.[0];
    if (file) {
      onFileSelected(file);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    selectFirstFile(event.dataTransfer.files);
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
          selectFirstFile(event.currentTarget.files);
        }}
        ref={inputRef}
        type="file"
      />
      <Button
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
