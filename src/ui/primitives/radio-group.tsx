import { cn } from "cn";
import {
  composeRenderProps,
  RadioButton as RadioButtonPrimitive,
  RadioField as RadioFieldPrimitive,
  RadioGroup as RadioGroupPrimitive,
  type RadioFieldProps,
  type RadioGroupProps,
} from "react-aria-components";

function RadioGroup({ className, ...props }: RadioGroupProps) {
  return <RadioGroupPrimitive className={cn("grid w-full gap-2", className)} data-slot="radio-group" {...props} />;
}

function RadioGroupItem({ className, children, ...props }: RadioFieldProps) {
  return (
    <RadioFieldPrimitive className={cn("grid", className)} data-slot="radio-group-item" {...props}>
      <RadioButtonPrimitive
        className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-surface px-3 text-sm outline-none data-[selected]:border-primary data-[selected]:bg-surface-raised data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60"
      >
        {composeRenderProps(children, (content, { isSelected }) => (
          <>
            <span aria-hidden="true" className="size-4 shrink-0 rounded-full border border-border bg-surface">
              {isSelected ? <span className="m-1 block size-2 rounded-full bg-primary" /> : null}
            </span>
            {content}
          </>
        ))}
      </RadioButtonPrimitive>
    </RadioFieldPrimitive>
  );
}

export { RadioGroup, RadioGroupItem };
