import * as React from "react"
import { cn } from "@/lib/utils"

// The focus ring is spelled out in real colours on purpose. `ring-ring` and
// `ring-offset-background` are shadcn tokens that were never defined in this
// project's Tailwind config, so they compiled to nothing and every button fell
// back to Tailwind's default translucent blue — all but invisible on the
// blue and indigo gradient buttons. The offset is what keeps the ring legible
// against the button's own fill.
const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800 disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button }
