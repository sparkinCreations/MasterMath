import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, Calculator, History, BookOpen, HelpCircle, MessageSquare, Moon, Sun, Settings, Scale } from "lucide-react";
import pkg from "../package.json";
import { useDarkMode } from "@/contexts/DarkModeContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "Solver",
    url: createPageUrl("Solver"),
    icon: Calculator,
  },
  {
    title: "My Progress",
    url: createPageUrl("Progress"),
    icon: History,
  },
  {
    title: "User Manual",
    url: createPageUrl("UserManual"),
    icon: BookOpen,
  },
  {
    title: "FAQ",
    url: createPageUrl("FAQ"),
    icon: HelpCircle,
  },
  {
    title: "How It Compares",
    url: createPageUrl("Compare"),
    icon: Scale,
  },
  {
    title: "Feedback & Support",
    url: createPageUrl("Feedback"),
    icon: MessageSquare,
  },
  {
    title: "Settings",
    url: createPageUrl("Settings"),
    icon: Settings,
  },
];

function AppSidebar() {
  const location = useLocation();
  const { setIsOpen } = useSidebar();
  // Collapse the menu after navigating so the page isn't left covered.
  const closeSidebar = () => setIsOpen(false);

  return (
    <Sidebar className="border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900" aria-label="Main navigation">
      <SidebarHeader className="border-b border-gray-200 dark:border-gray-800 p-6">
        {/* The logo images in these home links are decorative (alt=""): the link
            text names the destination, and a named image made screen readers
            say "MasterMath Logo MasterMath by sparkinCreations…" (October 2026
            screen-reader walk). */}
        <Link to="/" onClick={closeSidebar} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img
            src="/logo-224.webp"
            alt=""
            aria-hidden="true"
            className="w-11 h-11 rounded-lg"
          />
          {/* Brand text is a home link, not a heading — the page's own h1
              is the document title. Rendered as <p> so screen-reader users
              get one h1 per page and a clean outline. */}
          <div>
            <p className="font-display font-semibold text-xl text-gray-900 dark:text-gray-50">
              MasterMath
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Step-by-step math, solved locally</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="p-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    className={`relative hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150 rounded-md mb-1 ${
                      location.pathname === item.url
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-50 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-full before:bg-indigo-700 dark:before:bg-indigo-300'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <Link to={item.url} onClick={closeSidebar} aria-current={location.pathname === item.url ? "page" : undefined} className="flex items-center gap-3 px-4 py-2.5">
                      <item.icon className="w-[18px] h-[18px] text-gray-500 dark:text-gray-400" aria-hidden="true" />
                      <span className="font-medium">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export default function Layout({ children, update }) {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex flex-col w-full bg-paper dark:bg-gray-950">
        <div className="flex flex-1">
          <AppSidebar />

          {/* tabIndex={-1} so the skip link actually moves focus here, not
              just the scroll position. */}
          <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 flex flex-col focus:outline-hidden" role="main">
            {/* Sticky on phones so the menu and theme toggle stay reachable
                while a long solution scrolls; static on wider screens where
                the sidebar is always in reach. z-20 keeps it under the open
                sidebar's overlay (z-30). */}
            <header className="sticky top-0 z-20 md:static bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 md:px-6 py-3" role="banner">
              <div className="flex items-center justify-between">
                <SidebarTrigger className="text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded-md transition-colors duration-150" />
                <Link to="/" className="hidden md:flex items-center justify-center gap-2 flex-1 hover:opacity-80 transition-opacity">
                  <img
                    src="/logo-224.webp"
                    alt=""
                    aria-hidden="true"
                    className="w-8 h-8 rounded-md"
                  />
                  {/* Not a heading: the header brand is a home link, and
                      each page supplies its own h1. */}
                  <p className="flex items-baseline gap-2 text-gray-900 dark:text-gray-50">
                    <span className="font-display text-xl font-semibold">MasterMath</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">by sparkinCreations™</span>
                    <span className="hidden lg:inline text-sm text-gray-500 dark:text-gray-400"><span aria-hidden="true">·</span> Step-by-step math, solved locally</span>
                  </p>
                </Link>
                <Link to="/" className="flex md:hidden items-center gap-2 hover:opacity-80 transition-opacity">
                  <img
                    src="/logo-224.webp"
                    alt=""
                    aria-hidden="true"
                    className="w-7 h-7 rounded-md"
                  />
                  <p className="font-display text-lg font-semibold text-gray-900 dark:text-gray-50 leading-tight">
                    MasterMath
                    <span className="block font-sans text-xs font-normal text-gray-500 dark:text-gray-400 whitespace-nowrap">by sparkinCreations™</span>
                  </p>
                </Link>
                <button
                  onClick={toggleDarkMode}
                  className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150"
                  aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                  aria-pressed={isDarkMode}
                >
                  {isDarkMode ? (
                    <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
                  ) : (
                    <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
                  )}
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-auto">
              {children}
            </div>
          </main>
        </div>

        <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-6 py-4" role="contentinfo">
          {/* Two rows that wrap on their own, no "|" separators: with
              separators the row broke mid-list on narrow screens and left
              the bars orphaned on a line of their own. */}
          <div className="flex flex-col items-center gap-1 text-sm text-gray-600 dark:text-gray-400 text-center">
            <p className="flex flex-wrap items-center justify-center gap-x-1">
              <span>MasterMath by sparkinCreations™ v{pkg.version}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <span>© 2026</span>
                <a href="https://sparkincreations.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-11 px-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-200 underline decoration-gray-300 dark:decoration-gray-600 hover:decoration-indigo-600 dark:hover:decoration-indigo-400">sparkinCreations</a>
              </span>
            </p>
            {/* Only when this open page is behind a release; the next visit
                updates on its own, so this is an offer, never a prompt. On a
                line of its own: in the wrapping row above, its "·" dangled. */}
            {update?.updateAvailable && (
              <button
                type="button"
                onClick={update.applyUpdate}
                className="inline-flex items-center min-h-11 px-2 font-medium text-indigo-700 dark:text-indigo-300 underline decoration-indigo-300 dark:decoration-indigo-600 hover:decoration-indigo-600 dark:hover:decoration-indigo-300 transition-colors duration-200"
              >
                {update.newVersion ? `Update to v${update.newVersion}` : 'Update available'}
              </button>
            )}
            <nav aria-label="Policies and feedback" className="flex flex-wrap items-center justify-center gap-x-4">
              <Link to={createPageUrl("PrivacyPolicy")} className="inline-flex items-center min-h-11 px-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-200 underline decoration-gray-300 dark:decoration-gray-600 hover:decoration-indigo-600 dark:hover:decoration-indigo-400">Privacy Policy</Link>
              <Link to={createPageUrl("TermsOfService")} className="inline-flex items-center min-h-11 px-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-200 underline decoration-gray-300 dark:decoration-gray-600 hover:decoration-indigo-600 dark:hover:decoration-indigo-400">Terms of Service</Link>
              <Link to={createPageUrl("Feedback")} className="inline-flex items-center min-h-11 px-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-200 underline decoration-gray-300 dark:decoration-gray-600 hover:decoration-indigo-600 dark:hover:decoration-indigo-400">Feedback</Link>
            </nav>
          </div>
        </footer>
      </div>
    </SidebarProvider>
  );
}