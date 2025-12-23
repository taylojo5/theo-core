"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ChatInputProps {
  /** Called when user submits a message */
  onSend: (message: string) => void;
  /** Whether the input should be disabled (e.g., during streaming) */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Whether a message is currently being processed */
  isProcessing?: boolean;
  /** Additional className */
  className?: string;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Message Theo...",
  isProcessing = false,
  className,
}: ChatInputProps) {
  const [value, setValue] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [value]);

  const handleSubmit = React.useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();

      const trimmed = value.trim();
      if (!trimmed || disabled || isProcessing) return;

      onSend(trimmed);
      setValue("");

      // Reset height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    },
    [value, disabled, isProcessing, onSend]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Enter (without Shift)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const canSend = value.trim().length > 0 && !disabled && !isProcessing;

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}
    >
      <div className="mx-auto flex max-w-3xl items-end gap-2 p-4">
        {/* Textarea */}
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              "w-full resize-none rounded-2xl border bg-muted/50 px-4 py-3 pr-12 text-sm",
              "placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "max-h-[200px] min-h-[48px]"
            )}
          />

          {/* Character count (optional, shows when > 500 chars) */}
          {value.length > 500 && (
            <span className="absolute bottom-2 right-14 text-xs text-muted-foreground">
              {value.length}
            </span>
          )}
        </div>

        {/* Send button */}
        <Button
          type="submit"
          size="icon"
          disabled={!canSend}
          className={cn(
            "size-12 shrink-0 rounded-full transition-all",
            canSend
              ? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500"
              : ""
          )}
        >
          {isProcessing ? (
            // Stop icon when processing
            <svg
              className="size-5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            // Send icon
            <svg
              className="size-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          )}
          <span className="sr-only">
            {isProcessing ? "Stop" : "Send message"}
          </span>
        </Button>
      </div>

      {/* Hint text */}
      <div className="pb-2 text-center text-xs text-muted-foreground">
        <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
          Enter
        </kbd>{" "}
        to send,{" "}
        <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
          Shift + Enter
        </kbd>{" "}
        for new line
      </div>
    </form>
  );
}

