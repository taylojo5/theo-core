import * as React from "react";

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

// Pre-built skeleton patterns for common use cases

function SkeletonText({
  lines = 3,
  className,
  ...props
}: React.ComponentProps<"div"> & { lines?: number }) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", i === lines - 1 ? "w-3/4" : "w-full")}
        />
      ))}
    </div>
  );
}

function SkeletonAvatar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <Skeleton className={cn("size-10 rounded-full", className)} {...props} />
  );
}

function SkeletonCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("bg-card rounded-xl border p-6 shadow-sm", className)}
      {...props}
    >
      <div className="flex items-center gap-4">
        <SkeletonAvatar />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-4">
        <SkeletonText lines={2} />
      </div>
    </div>
  );
}

function SkeletonMessage({
  align = "left",
  className,
  ...props
}: React.ComponentProps<"div"> & { align?: "left" | "right" }) {
  return (
    <div
      className={cn(
        "flex gap-3",
        align === "right" && "flex-row-reverse",
        className
      )}
      {...props}
    >
      <SkeletonAvatar className="size-8 shrink-0" />
      <div
        className={cn(
          "max-w-[70%] space-y-2",
          align === "right" && "items-end"
        )}
      >
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-48 rounded-2xl" />
      </div>
    </div>
  );
}

export {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonMessage,
};
