import type * as React from "react";
import { cn } from "cn";
import {
  Button as ButtonPrimitive,
  Link as LinkPrimitive,
  type ButtonProps as ButtonPrimitiveProps,
  type LinkProps as LinkPrimitiveProps,
} from "react-aria-components";

const buttonBase =
  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border px-3 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60";

const buttonVariants = {
  default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/85",
  outline: "border-border bg-surface text-foreground hover:bg-surface-raised",
  secondary: "border-transparent bg-surface-raised text-foreground hover:bg-muted",
  ghost: "border-transparent bg-transparent text-foreground hover:bg-surface-raised",
  destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/85",
  link: "border-transparent bg-transparent text-primary underline-offset-4 hover:underline",
} as const;

const buttonSizes = {
  default: "gap-2",
  sm: "min-h-9 gap-1.5 px-2.5 text-xs",
  lg: "min-h-12 gap-2.5 px-4",
  icon: "size-11 p-0",
  "icon-sm": "size-9 min-h-9 p-0",
} as const;

type ButtonVariant = keyof typeof buttonVariants;
type ButtonSize = keyof typeof buttonSizes;

interface SharedButtonProps {
  className?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: Omit<ButtonPrimitiveProps, "className"> &
  React.RefAttributes<HTMLButtonElement> &
  SharedButtonProps) {
  return (
    <ButtonPrimitive
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      data-size={size}
      data-slot="button"
      data-variant={variant}
      {...props}
    />
  );
}

function LinkButton({
  className,
  variant = "default",
  size = "default",
  ...props
}: Omit<LinkPrimitiveProps, "className"> & SharedButtonProps) {
  return (
    <LinkPrimitive
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      data-size={size}
      data-slot="button"
      data-variant={variant}
      {...props}
    />
  );
}

export { Button, LinkButton, type ButtonSize, type ButtonVariant };
