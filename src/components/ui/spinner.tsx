import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const spinnerVariants = cva(
  "animate-spin rounded-full border-2 border-current border-t-transparent",
  {
    variants: {
      size: {
        sm: "size-4",
        default: "size-6",
        lg: "size-8",
        xl: "size-12",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

interface SpinnerProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof spinnerVariants> {
  /** Screen reader label */
  label?: string
}

function Spinner({
  className,
  size,
  label = "Loading...",
  ...props
}: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(spinnerVariants({ size }), className)}
      {...props}
    >
      <span className="sr-only">{label}</span>
    </div>
  )
}

interface LoadingOverlayProps extends React.ComponentProps<"div"> {
  /** Whether the overlay is visible */
  visible?: boolean
  /** Loading message to display */
  message?: string
}

function LoadingOverlay({
  visible = true,
  message,
  className,
  ...props
}: LoadingOverlayProps) {
  if (!visible) return null

  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm",
        className
      )}
      {...props}
    >
      <Spinner size="lg" />
      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  )
}

export { Spinner, spinnerVariants, LoadingOverlay }

