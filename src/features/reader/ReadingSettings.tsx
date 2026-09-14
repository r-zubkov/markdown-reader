import type { ReaderPresentation } from "@/domain/reading/reader-presentation";
import type { SectionLayout, SplitStrategy } from "@/domain/content/pipeline-types";
import { readerCopy } from "@/features/reader/copy";
import { Button } from "@/ui/primitives/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/ui/primitives/dialog";
import { RadioGroup, RadioGroupItem } from "@/ui/primitives/radio-group";

interface ReadingSettingsProps {
  readonly applying: boolean;
  readonly layouts: Record<SplitStrategy, SectionLayout>;
  readonly onModeChange: (mode: ReaderPresentation["mode"]) => void;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onStrategyChange: (strategy: SplitStrategy) => void;
  readonly presentation: ReaderPresentation;
}

const strategies = ["auto", "h1", "h2", "h3", "whole"] as const satisfies readonly SplitStrategy[];

export function ReadingSettings({ applying, layouts, onModeChange, onOpenChange, onStrategyChange, presentation }: ReadingSettingsProps) {
  const whole = layouts.whole;
  return <DialogTrigger {...(onOpenChange === undefined ? {} : { onOpenChange })}><Button aria-label={readerCopy.openSettings} variant="outline">{readerCopy.settings}</Button><Dialog className="reading-settings">
    <DialogHeader><DialogTitle>{readerCopy.settings}</DialogTitle><DialogDescription>{readerCopy.settingsDescription}</DialogDescription></DialogHeader>
    <fieldset disabled={applying}><legend>{readerCopy.readingMode}</legend><RadioGroup aria-label={readerCopy.readingMode} onChange={(value) => { if (value === "continuous" || value === "sections") onModeChange(value); }} value={presentation.mode}>
      <RadioGroupItem value="continuous">{readerCopy.continuousMode}</RadioGroupItem>
      <RadioGroupItem value="sections">{readerCopy.sectionsMode}</RadioGroupItem>
    </RadioGroup></fieldset>
    <fieldset disabled={applying}><legend>{readerCopy.splitStrategy}</legend><p className="reading-settings__help">{presentation.mode === "continuous" ? readerCopy.strategyContinuousHint : readerCopy.strategyHint}</p><RadioGroup {...(!whole.safeForSelection ? { "aria-describedby": "whole-unavailable" } : {})} aria-label={readerCopy.splitStrategy} onChange={(value) => { if (isSplitStrategy(value)) onStrategyChange(value); }} value={presentation.splitStrategy}>
      {strategies.map((strategy) => <RadioGroupItem isDisabled={strategy === "whole" && !whole.safeForSelection} key={strategy} value={strategy}>{readerCopy.strategies[strategy]}</RadioGroupItem>)}
    </RadioGroup>{!whole.safeForSelection ? <p id="whole-unavailable" role="note">{readerCopy.wholeUnavailable} {readerCopy.wholeRecommendation}</p> : null}</fieldset>
    {applying ? <p role="status">{readerCopy.applyingSettings}</p> : null}
  </Dialog></DialogTrigger>;
}

function isSplitStrategy(value: string): value is SplitStrategy { return strategies.some((strategy) => strategy === value); }
