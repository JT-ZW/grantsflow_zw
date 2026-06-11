"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

interface SubmitButtonProps {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  variant?: "primary" | "brand" | "green" | "blue" | "danger";
}

const VARIANTS = {
  primary: "bg-[#6b1a2a] hover:bg-[#5a1522] text-white",
  brand:   "bg-[#6b1a2a] hover:bg-[#5a1522] text-white",
  green:   "bg-green-600 hover:bg-green-700 text-white",
  blue:    "bg-blue-600 hover:bg-blue-700 text-white",
  danger:  "bg-red-600 hover:bg-red-700 text-white",
};

export function SubmitButton({ children, pendingText, className, variant = "primary" }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60",
        VARIANTS[variant],
        className
      )}
    >
      {pending && (
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {pending ? (pendingText ?? "Saving…") : children}
    </button>
  );
}
