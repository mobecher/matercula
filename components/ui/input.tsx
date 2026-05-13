import type { InputHTMLAttributes } from "react";

const cn = (...classes: Array<string | undefined>) => classes.filter(Boolean).join(" ");

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none ring-neutral-900 focus:ring-2",
        className,
      )}
      {...props}
    />
  );
}
