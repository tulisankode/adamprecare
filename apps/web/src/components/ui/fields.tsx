import { forwardRef, useId } from "react";
import { CalendarDays, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";

export function FieldLabel({ htmlFor, children, className }: { htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-2 block text-sm font-medium text-ink", className)}>
      {children}
    </label>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-danger">
      {message}
    </p>
  );
}

const inputBase =
  "w-full rounded-md border border-line bg-white text-sm text-ink placeholder:text-muted outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-ring/60 disabled:bg-row-alt";

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  invalid?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { leftIcon, rightSlot, invalid, className, ...rest },
  ref,
) {
  return (
    <div className="relative">
      {leftIcon && (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">{leftIcon}</span>
      )}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          inputBase,
          "h-10 px-3",
          leftIcon && "pl-10",
          rightSlot && "pr-10",
          invalid && "border-danger focus:border-danger",
          className,
        )}
        {...rest}
      />
      {rightSlot && <span className="absolute top-1/2 right-2 -translate-y-1/2">{rightSlot}</span>}
    </div>
  );
});

export function SearchInput(props: TextInputProps) {
  return <TextInput type="search" leftIcon={<Search className="size-4" aria-hidden />} {...props} />;
}

export interface SelectInputProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(function SelectInput(
  { className, invalid, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(inputBase, "h-10 appearance-none pr-9 pl-3", invalid && "border-danger", className)}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 fill-ink text-ink"
        aria-hidden
      />
    </div>
  );
});

export interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

export function DateInput({ label, className, ...rest }: DateInputProps) {
  return (
    <div className={cn("relative", className)}>
      <CalendarDays className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink" aria-hidden />
      <input type="date" aria-label={label} className={cn(inputBase, "relative h-10 pr-2 pl-9")} {...rest} />
    </div>
  );
}

export function DateRangeInputs({
  from,
  to,
  onChange,
  idPrefix,
}: {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  idPrefix?: string;
}) {
  const gen = useId();
  const id = idPrefix ?? gen;
  return (
    <div className="flex items-center gap-2">
      <DateInput
        id={`${id}-from`}
        label="Tanggal awal"
        value={from}
        max={to || undefined}
        onChange={(e) => onChange({ from: e.target.value, to })}
        className="min-w-0 flex-1"
      />
      <span className="font-semibold text-ink" aria-hidden>
        -
      </span>
      <DateInput
        id={`${id}-to`}
        label="Tanggal akhir"
        value={to}
        min={from || undefined}
        onChange={(e) => onChange({ from, to: e.target.value })}
        className="min-w-0 flex-1"
      />
    </div>
  );
}

export const TextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function TextArea({ className, invalid, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(inputBase, "min-h-20 px-3 py-2", invalid && "border-danger", className)}
        {...rest}
      />
    );
  },
);
