import type { LabelHTMLAttributes } from "react";

const cn = (...classes: Array<string | undefined>) => classes.filter(Boolean).join(" ");

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  // biome-ignore lint/a11y/noLabelWithoutControl: This component forwards htmlFor from call sites.
  return <label className={cn("text-sm font-medium", className)} {...props} />;
}
