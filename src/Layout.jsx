import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, Calculator, History, BookOpen, Shield, Scale, MessageSquare, Moon, Sun } from "lucide-react";
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
    title: "Feedback & Support",
    url: createPageUrl("Feedback"),
    icon: MessageSquare,
  },
  {
    title: "Privacy Policy",
    url: createPageUrl("PrivacyPolicy"),
    icon: Shield,
  },
  {
    title: "Terms of Service",
    url: createPageUrl("TermsOfService"),
    icon: Scale,
  },
];

export default function Layout({ children }) {
  const location = useLocation();
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <SidebarProvider defaultOpen={false}>
      <style>{`
        :root {
          --primary: 250 100% 65%;
          --primary-foreground: 0 0% 100%;
          --secondary: 280 90% 70%;
          --accent: 160 80% 60%;
          --success: 140 70% 55%;
          --background: 220 20% 98%;
          --card: 0 0% 100%;
        }
      `}</style>
      
      <div className="min-h-screen flex flex-col w-full bg-gradient-to-br from-blue-50 via-purple-50 to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="flex flex-1">
          <Sidebar className="border-r border-purple-100 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <SidebarHeader className="border-b border-purple-100 p-6">
              <div className="flex items-center gap-3">
                <img
                  src="/favicon.png"
                  alt="MasterMath Logo"
                  className="w-12 h-12 rounded-2xl shadow-lg"
                />
                <div>
                  <h2 className="font-bold text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    MasterMath
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Master math with confidence</p>
                </div>
              </div>
            </SidebarHeader>

            <SidebarContent className="p-3">
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {navigationItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          className={`hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-600 transition-all duration-200 rounded-xl mb-2 ${
                            location.pathname === item.url
                              ? 'bg-gradient-to-r from-blue-100 to-purple-100 dark:from-gray-600 dark:to-gray-700 text-purple-700 dark:text-purple-300 shadow-sm'
                              : ''
                          }`}
                        >
                          <Link to={item.url} className="flex items-center gap-3 px-4 py-3 dark:text-gray-200">
                            <item.icon className="w-5 h-5" />
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

          <main className="flex-1 flex flex-col">
            <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700 px-6 py-4 shadow-sm">
              <div className="flex items-center justify-between">
                <SidebarTrigger className="hover:bg-purple-50 dark:hover:bg-gray-700 p-2 rounded-lg transition-colors duration-200" />
                <div className="hidden md:block text-center flex-1">
                  <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    MasterMath <span className="text-sm font-normal text-gray-400 dark:text-gray-500">by sparkinCreations™</span> <span className="text-base font-normal text-gray-500 dark:text-gray-400">- Master math with confidence</span>
                  </h1>
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent md:hidden">
                  MasterMath <span className="text-xs font-normal text-gray-400 dark:text-gray-500">by sparkinCreations™</span>
                </h1>
                <button
                  onClick={toggleDarkMode}
                  className="p-2 rounded-lg hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors duration-200"
                  aria-label="Toggle dark mode"
                >
                  {isDarkMode ? (
                    <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  )}
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-auto">
              {children}
            </div>
          </main>
        </div>

        <footer className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-t border-purple-100 dark:border-gray-700 px-6 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-1 text-sm text-gray-600 dark:text-gray-400 text-center">
            <span>MasterMath by sparkinCreations™ v1.1.0</span>
            <span className="hidden sm:inline">|</span>
            <span className="flex items-center gap-1">
              <span>© 2025</span>
              <a
                href="https://sparkincreations.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors duration-200 underline decoration-gray-300 hover:decoration-purple-600"
              >
                sparkinCreations
              </a>
            </span>
            <span className="hidden sm:inline">|</span>
            <Link
              to={createPageUrl("PrivacyPolicy")}
              className="text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors duration-200 underline decoration-gray-300 hover:decoration-purple-600"
            >
              Privacy Policy
            </Link>
            <span className="hidden sm:inline">|</span>
            <Link
              to={createPageUrl("TermsOfService")}
              className="text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors duration-200 underline decoration-gray-300 hover:decoration-purple-600"
            >
              Terms of Service
            </Link>
            <span className="hidden sm:inline">|</span>
            <Link
              to={createPageUrl("Feedback")}
              className="text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors duration-200 underline decoration-gray-300 hover:decoration-purple-600"
            >
              Feedback
            </Link>
          </div>
        </footer>
      </div>
    </SidebarProvider>
  );
}