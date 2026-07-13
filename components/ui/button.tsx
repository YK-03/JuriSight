"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "icon";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] border border-[var(--btn-primary-border)]
            hover:bg-[var(--btn-primary-hover-bg)] hover:text-[var(--btn-primary-hover-text)] hover:border-[var(--btn-primary-hover-border)]`,
  secondary: `bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] border border-[var(--btn-secondary-border)]
              hover:bg-[var(--btn-secondary-hover-bg)] hover:text-[var(--btn-secondary-hover-text)] hover:border-[var(--btn-secondary-hover-border)]`,
  ghost: `bg-transparent text-[var(--btn-ghost-text)] border border-transparent
          hover:bg-[var(--btn-ghost-hover-bg)] hover:text-[var(--btn-ghost-hover-text)]`,
  destructive: `bg-[var(--btn-destructive-bg)] text-[var(--btn-destructive-text)] border border-[var(--btn-destructive-border)]
                hover:bg-[var(--btn-destructive-hover-bg)] hover:text-[var(--btn-destructive-hover-text)] hover:border-[var(--btn-destructive-hover-border)]`,
  icon: `bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] border border-[var(--btn-primary-border)]
         hover:border-[var(--btn-primary-hover-border)] hover:text-[var(--btn-primary-hover-text)] hover:bg-[var(--btn-primary-hover-bg)]`,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 py-2 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-10 w-10 p-2 shrink-0",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || loading;
    
    return (
      <Comp
        ref={ref}
        disabled={isDisabled}
        className={cn(
          "relative inline-flex items-center justify-center rounded-[10px] font-medium whitespace-nowrap",
          "transition-all duration-200 ease-in-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--btn-focus-ring)] focus-visible:ring-offset-2",
          // Hover interactions (disabled shouldn't animate)
          !isDisabled && "hover:-translate-y-[1px]",
          isDisabled && "opacity-50 cursor-not-allowed pointer-events-none",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
              </span>
            )}
            <span className={cn("inline-flex items-center justify-center gap-2", loading && "opacity-0")}>
              {children}
            </span>
          </>
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";