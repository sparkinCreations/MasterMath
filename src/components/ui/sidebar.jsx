import * as React from "react"
import { cn } from "@/lib/utils"

const SIDEBAR_ID = "app-sidebar"

const SidebarContext = React.createContext({ isOpen: true, setIsOpen: () => {} })

// Read/control the sidebar from any descendant of SidebarProvider —
// e.g. to auto-collapse the menu after a navigation link is clicked.
const useSidebar = () => React.useContext(SidebarContext)

const SidebarProvider = ({ children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen)

  return (
    <SidebarContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </SidebarContext.Provider>
  )
}

const Sidebar = React.forwardRef(({ className, ...props }, ref) => {
  const { isOpen, setIsOpen } = React.useContext(SidebarContext)

  // Escape closes an open menu (it is a drawer on small screens).
  React.useEffect(() => {
    if (!isOpen) return undefined
    const onKey = (e) => { if (e.key === "Escape") setIsOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, setIsOpen])

  // A zero-width sidebar is still in the tab order and the accessibility
  // tree, so a collapsed menu would strand keyboard users on seven invisible
  // links before the page content. `inert` (with aria-hidden for older
  // engines) removes it properly while keeping the width transition.
  //
  // On small screens the open menu is an overlay drawer with a backdrop —
  // pushing a 256px column into a 390px viewport squeezed the page to a
  // 130px sliver (one word per line) beside it.
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          aria-hidden="true"
          onClick={() => setIsOpen(false)}
        />
      )}
      <aside
        ref={ref}
        id={SIDEBAR_ID}
        className={cn(
          "shrink-0 transition-all duration-300",
          isOpen
            ? "w-64 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:max-w-[85vw] max-md:overflow-y-auto max-md:shadow-2xl"
            : "w-0 overflow-hidden",
          className
        )}
        {...(isOpen ? {} : { inert: "", "aria-hidden": "true" })}
        {...props}
      />
    </>
  )
})
Sidebar.displayName = "Sidebar"

const SidebarHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-4 py-3", className)}
    {...props}
  />
))
SidebarHeader.displayName = "SidebarHeader"

const SidebarContent = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-1 overflow-auto py-2", className)}
    {...props}
  />
))
SidebarContent.displayName = "SidebarContent"

const SidebarGroup = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-3 py-2", className)}
    {...props}
  />
))
SidebarGroup.displayName = "SidebarGroup"

const SidebarGroupContent = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("", className)}
    {...props}
  />
))
SidebarGroupContent.displayName = "SidebarGroupContent"

const SidebarMenu = React.forwardRef(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("space-y-1", className)}
    {...props}
  />
))
SidebarMenu.displayName = "SidebarMenu"

const SidebarMenuItem = React.forwardRef(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn("", className)}
    {...props}
  />
))
SidebarMenuItem.displayName = "SidebarMenuItem"

const SidebarMenuButton = React.forwardRef(({ className, asChild = false, children, ...props }, ref) => {
  if (asChild) {
    return <>{children}</>
  }

  return (
    <button
      ref={ref}
      className={cn(
        "w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-100",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
})
SidebarMenuButton.displayName = "SidebarMenuButton"

const SidebarTrigger = React.forwardRef(({ className, ...props }, ref) => {
  const { isOpen, setIsOpen } = React.useContext(SidebarContext)

  return (
    <button
      ref={ref}
      type="button"
      aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
      aria-expanded={isOpen}
      aria-controls={SIDEBAR_ID}
      className={cn("p-2 transition-transform duration-300", className)}
      onClick={() => setIsOpen(prev => !prev)}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        className={cn("transition-transform duration-300", isOpen ? "" : "rotate-180")}
      >
        <path d="M18 15l-6-6-6 6" transform="rotate(-90 12 12)" />
      </svg>
    </button>
  )
})
SidebarTrigger.displayName = "SidebarTrigger"

export {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
}
