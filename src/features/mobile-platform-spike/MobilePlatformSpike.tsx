import { useEffect, useId, useState } from "react";

import { mobilePlatformCopy as copy } from "./copy";
import { PwaUpdatePrompt } from "./PwaUpdatePrompt";
import { Button } from "@/ui/primitives/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/primitives/dialog";
import { RadioGroup, RadioGroupItem } from "@/ui/primitives/radio-group";
import { FileDropField } from "@/ui/primitives/file-drop-field";
import {
  Sheet,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/ui/primitives/sheet";

type ImportStage = "idle" | "running" | "decision" | "error";
type ApplyState = "idle" | "applying" | "error" | "ready";

const outlineEntries = Array.from({ length: 36 }, (_, index) => `Section ${String(index + 1)} — long mobile outline label`);

export function MobilePlatformSpike() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importStage, setImportStage] = useState<ImportStage>("idle");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [readingMode, setReadingMode] = useState("continuous");
  const [applyState, setApplyState] = useState<ApplyState>("idle");
  const [selectedFileName, setSelectedFileName] = useState<string>();
  const [dark, setDark] = useState(false);
  const modeDescriptionId = useId();

  useEffect(() => {
    if (dialogOpen && importStage === "decision") {
      document.getElementById("mobile-platform-decision-title")?.focus();
    }
  }, [dialogOpen, importStage]);

  function closeDialog(isOpen: boolean) {
    setDialogOpen(isOpen);
    if (!isOpen) {
      setImportStage("idle");
    }
  }

  function chooseFile(file: File | undefined) {
    if (!file) return;
    setSelectedFileName(file.name);
  }

  function changeMode(nextMode: string) {
    setApplyState("applying");
    window.setTimeout(() => {
      if (nextMode === "error") {
        setApplyState("error");
        return;
      }
      setReadingMode(nextMode);
      setApplyState("ready");
    }, 120);
  }

  const dialogTitle = {
    decision: copy.decisionTitle,
    error: "Не удалось завершить подготовку",
    idle: copy.dialogTitle,
    running: copy.runningTitle,
  }[importStage];

  return (
    <main
      aria-labelledby="mobile-platform-title"
      className={dark ? "mobile-platform-spike mobile-platform-spike--dark" : "mobile-platform-spike"}
      data-overlay-stage={dialogOpen ? importStage : "closed"}
      data-testid="mobile-platform-spike"
    >
      <header className="mobile-platform-spike__header">
        <div>
          <p className="mobile-platform-spike__eyebrow">P00-T06</p>
          <h1 id="mobile-platform-title">Mobile UI and platform primitives</h1>
        </div>
        <Button
          onPress={() => {
            setDark((current) => !current);
          }}
          variant="outline"
        >
          Toggle theme
        </Button>
      </header>

      <section className="mobile-platform-spike__grid" aria-label="Primitive harness">
        <section className="mobile-platform-spike__panel">
          <h2>Dialog state replacement</h2>
          <DialogTrigger isOpen={dialogOpen} onOpenChange={closeDialog}>
            <Button>{copy.openDialog}</Button>
            <Dialog
              isDismissable={importStage !== "running"}
              isKeyboardDismissDisabled={importStage === "running"}
              showCloseButton={importStage !== "running"}
            >
              <DialogHeader>
                <DialogTitle
                  id="mobile-platform-decision-title"
                  tabIndex={importStage === "decision" ? -1 : undefined}
                >
                  {dialogTitle}
                </DialogTitle>
                <DialogDescription>
                  {importStage === "running"
                    ? copy.runningBody
                    : importStage === "decision"
                      ? copy.decisionBody
                      : importStage === "error"
                        ? copy.asyncApplyError
                        : copy.dialogBody}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                {importStage === "idle" ? (
                  <Button
                    onPress={() => {
                      setImportStage("running");
                    }}
                  >
                    Start local preparation
                  </Button>
                ) : null}
                {importStage === "running" ? (
                  <Button
                    onPress={() => {
                      setImportStage("decision");
                    }}
                    variant="outline"
                  >
                    Request cancellation
                  </Button>
                ) : null}
                {importStage === "decision" ? (
                  <>
                    <Button
                      onPress={() => {
                        setImportStage("error");
                      }}
                      variant="destructive"
                    >
                      Simulate error
                    </Button>
                    <Button
                      onPress={() => {
                        closeDialog(false);
                      }}
                      variant="outline"
                    >
                      {copy.close}
                    </Button>
                  </>
                ) : null}
                {importStage === "error" ? (
                  <Button
                    onPress={() => {
                      setImportStage("idle");
                    }}
                  >
                    {copy.retry}
                  </Button>
                ) : null}
              </DialogFooter>
            </Dialog>
          </DialogTrigger>
        </section>

        <section className="mobile-platform-spike__panel">
          <h2>Reading setting</h2>
          <p id={modeDescriptionId}>{copy.settingDescription}</p>
          <RadioGroup
            aria-describedby={modeDescriptionId}
            aria-label={copy.settingLabel}
            isDisabled={applyState === "applying"}
            onChange={changeMode}
            value={readingMode}
          >
            <RadioGroupItem className="mobile-platform-spike__radio-label" value="continuous">
              Continuous reading
            </RadioGroupItem>
            <RadioGroupItem className="mobile-platform-spike__radio-label" value="sections">
              By sections
            </RadioGroupItem>
            <RadioGroupItem className="mobile-platform-spike__radio-label" value="error">
              Simulate unavailable setting
            </RadioGroupItem>
          </RadioGroup>
          <p aria-live="polite" className="mobile-platform-spike__status">
            {applyState === "applying"
              ? copy.asyncApplying
              : applyState === "error"
                ? copy.asyncApplyError
                : applyState === "ready"
                  ? copy.asyncReady
                  : ""}
          </p>
        </section>

        <section className="mobile-platform-spike__panel">
          <h2>File trigger and drop zone</h2>
          <FileDropField
            accept=".md,text/markdown"
            buttonLabel={copy.chooseFile}
            description={copy.dropHint}
            inputTestId="mobile-platform-file-input"
            label={copy.dropLabel}
            onFileSelected={chooseFile}
            selectedFileName={selectedFileName}
            selectedLabel={copy.fileAccepted}
          />
        </section>

        <section className="mobile-platform-spike__panel">
          <h2>Scrollable Sheet</h2>
          <SheetTrigger isOpen={sheetOpen} onOpenChange={setSheetOpen}>
            <Button variant="outline">{copy.openSheet}</Button>
            <Sheet className="mobile-platform-spike__sheet" side="bottom">
              <SheetHeader>
                <SheetTitle>{copy.sheetTitle}</SheetTitle>
                <SheetDescription>{copy.sheetBody}</SheetDescription>
              </SheetHeader>
              <ol className="mobile-platform-spike__outline">
                {outlineEntries.map((entry) => (
                  <li key={entry}>
                    <button type="button">{entry}</button>
                  </li>
                ))}
              </ol>
              <SheetFooter className="mobile-platform-spike__sheet-footer">
                <Button
                  onPress={() => {
                    setSheetOpen(false);
                  }}
                >
                  {copy.footerAction}
                </Button>
              </SheetFooter>
            </Sheet>
          </SheetTrigger>
        </section>
      </section>

      <PwaUpdatePrompt />
      <p className="mobile-platform-spike__scroll-probe">
        Background scroll probe — this content deliberately exceeds a mobile viewport.
      </p>
    </main>
  );
}
