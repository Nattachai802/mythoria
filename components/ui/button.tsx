import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // Default: Forge Gold - The primary action button
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(245,158,11,0.3)] active:translate-y-0",

        // Forge: Chamfered industrial style with strong glow
        forge:
          "bg-primary text-primary-foreground font-semibold tracking-wide uppercase hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] active:translate-y-0 chamfered",

        // Destructive: Warning/Delete actions
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 hover:-translate-y-0.5 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",

        // Outline: Secondary actions with gold border on hover
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground hover:border-primary/50 dark:bg-input/30 dark:border-input dark:hover:bg-input/50 dark:hover:border-primary/50",

        // Secondary: Subtle background
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",

        // Ghost: Minimal style
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",

        // Link: Text only
        link: "text-primary underline-offset-4 hover:underline",

        // Industrial: Outline with tech feel
        industrial:
          "border border-steel-600 bg-transparent text-foreground font-mono text-xs uppercase tracking-wider hover:border-primary hover:text-primary hover:shadow-[0_0_10px_rgba(245,158,11,0.2)]",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-sm gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-sm px-6 has-[>svg]:px-4",
        xl: "h-12 rounded-sm px-8 text-base has-[>svg]:px-6",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
