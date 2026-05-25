"use client";

import { useState } from "react";

interface PasswordInputProps {
  id: string;
  name: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  className?: string;
}

export function PasswordInput({
  id,
  name,
  autoComplete = "current-password",
  required = false,
  minLength,
  placeholder = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
  className = "",
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      {/* eslint-disable-next-line jsx-a11y/autocomplete-valid */}
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={visible ? "off" : autoComplete}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`}
        suppressHydrationWarning
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 focus:outline-none"
        tabIndex={-1}
      >
        {visible ? (
          /* Eye-off icon */
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7s4-7 9-7c1.01 0 1.985.148 2.906.425M6.1 6.1l11.8 11.8M9.88 9.88A3 3 0 0014.12 14.12M3 3l18 18" />
          </svg>
        ) : (
          /* Eye icon */
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
      </button>
    </div>
  );
}
