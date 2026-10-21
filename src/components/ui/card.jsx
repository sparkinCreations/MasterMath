import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("rounded-lg border bg-card text-card-foreground shadow-xs", className)}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

// Defaults to h2: a card usually sits directly under the page's h1, and its
// content headings (SolutionDisplay's "Step-by-Step Solution:", etc.) are h3.
// Pass `as` when the card is nested under a section heading — Home's feature
// cards live under h2 sections and use as="h3".
const CardTitle = React.forwardRef(({ className, as: Tag = "h2", ...props }, ref) => (
  <Tag
    ref={ref}
    // A text colour of its own: a title that inherits gets browser-default
    // black on a dark card (the empty graph card's "Graph View" did).
    className={cn("text-2xl font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-100", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

export { Card, CardHeader, CardTitle, CardContent }
