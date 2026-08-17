import * as React from "react"
import { cn } from "@/lib/utils"

// The focus ring is spelled out in real colours on purpose. `ring-ring` and
// `ring-offset-background` are shadcn tokens that were never defined in this
// project's Tailwind config, so they compiled to nothing and every button fell
// back to Tailwind's default translucent blue — all but invisible on the
// blue and indigo gradient buttons. The offset is what keeps the ring legible
// against the button's own fill.
const BUTTON_CLASS =
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800 disabled:pointer-events-none disabled:opacity-50"

// `asChild` renders the button's styling onto the single child element instead
// of emitting a <button>. It exists for the link-styled-as-a-button case: a
// <button> inside an <a> is invalid HTML, and browsers and screen readers
// disagree about which element is the control — Enter and Space can land on
// different targets, and the accessible name comes out of the wrong node.
// shadcn does this with Radix's Slot; cloning the child is the whole of it,
// and this project has no Radix dependency to add for it.
const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const classes = cn(BUTTON_CLASS, className)

  if (asChild) {
    const { children, ...rest } = props
    const child = React.Children.only(children)
    return React.cloneElement(child, {
      ...rest,
      ref,
      // Child classes last so a caller can still override, matching how
      // className behaves on a plain <Button>.
      className: cn(classes, child.props.className),
    })
  }

  return <button className={classes} ref={ref} {...props} />
})
Button.displayName = "Button"

export { Button }
