import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";;

export function H1({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn("scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl", className)}
      {...props}
    />
  );
}

export function H2({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("scroll-m-20 border-b border-border pb-2 text-3xl font-semibold tracking-tight first:mt-0", className)}
      {...props}
    />
  );
}

export function H3({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("scroll-m-20 text-2xl font-semibold tracking-tight", className)} {...props} />;
}

export function Lead({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xl text-text-secondary", className)} {...props} />;
}

export function P({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("leading-7 [&:not(:first-child)]:mt-4", className)} {...props} />;
}

export function Small({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <small className={cn("text-sm font-medium leading-none", className)} {...props} />;
}

export function Muted({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-text-secondary", className)} {...props} />;
}