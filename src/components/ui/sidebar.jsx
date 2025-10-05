import * as React from "react"
import { cn } from "@/lib/utils"

const SidebarContext = React.createContext({ isOpen: true, setIsOpen: () => {} })

const SidebarProvider = ({ children }) => {
  const [isOpen, setIsOpen] = React.useState(true)

  return (
    <SidebarContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </SidebarContext.Provider>
  )
}

const Sidebar = React.forwardRef(({ className, ...props }, ref) => {
  const { isOpen } = React.useContext(SidebarContext)

  return (
    <aside
      ref={ref}
      className={cn(
        "shrink-0 transition-all duration-300",
        isOpen ? "w-64" : "w-0 overflow-hidden",
        className
      )}
      {...props}
    />
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
}
