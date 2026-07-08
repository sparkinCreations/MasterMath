import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Palette,
  Sun,
  Moon,
  SlidersHorizontal,
  HardDrive,
  Download,
  Trash2,
  ChevronDown,
  Info,
} from "lucide-react";
import { useDarkMode } from "@/contexts/DarkModeContext";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { usePageTitle } from "@/hooks/usePageTitle";
import { getSettings, saveSettings } from "@/lib/settings";
import { fetchProblemHistory, clearProblemHistory } from "@/lib/api";
import { exportAsCSV, exportAsJSON, exportAsMarkdown, exportAsPDF } from "@/lib/exportUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import pkg from "../../package.json";

const TOPIC_LABELS = {
  derivatives: "Derivatives",
  integrals: "Integrals",
  limits: "Limits",
  functions: "Functions",
  trigonometry: "Trigonometry",
  algebra: "Algebra",
  other: "Arithmetic",
};

const ANGLE_UNIT_OPTIONS = [
  { value: "auto", label: "Auto-detect", description: "sin(30) reads as degrees, sin(pi/6) as radians" },
  { value: "degrees", label: "Degrees", description: "Plain numbers are always degrees" },
  { value: "radians", label: "Radians", description: "Plain numbers are always radians" },
];

const DECIMAL_OPTIONS = [2, 3, 4, 5, 6];

function OptionButton({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
        active
          ? "border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold"
          : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

export default function Settings() {
  usePageTitle("Settings - Customize MasterMath");
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const toast = useToast();
  const confirm = useConfirm();
  const [settings, setSettings] = useState(() => getSettings());

  const setTheme = (dark) => {
    if (dark !== isDarkMode) toggleDarkMode();
  };

  const updateSetting = (partial, message) => {
    const merged = saveSettings(partial);
    setSettings(merged);
    toast.success(message);
  };

  const handleExport = async (format) => {
    try {
      const problems = await fetchProblemHistory();
      if (!problems || problems.length === 0) {
        toast.info("No problem history to export yet");
        return;
      }
      switch (format) {
        case "pdf":
          exportAsPDF(problems, TOPIC_LABELS);
          break;
        case "csv":
          exportAsCSV(problems, TOPIC_LABELS);
          break;
        case "json":
          exportAsJSON(problems);
          break;
        case "markdown":
          exportAsMarkdown(problems, TOPIC_LABELS);
          break;
      }
      toast.success(`Exported ${problems.length} problems as ${format.toUpperCase()}`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export. Please try again.");
    }
  };

  const handleClearHistory = async () => {
    const confirmed = await confirm(
      "Are you sure you want to clear all your problem history? This action cannot be undone.",
      "Clear All History"
    );
    if (!confirmed) return;

    try {
      await clearProblemHistory();
      toast.success("Problem history cleared successfully");
    } catch (error) {
      console.error("Error clearing history:", error);
      toast.error("Failed to clear history. Please try again.");
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent mb-2">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Customize how MasterMath looks and solves — everything is saved on this device.
        </p>
      </div>

      {/* Appearance */}
      <Card className="mb-6 border-2 border-indigo-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <Palette className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="font-medium text-gray-800 dark:text-gray-200 mb-3">Theme</p>
          <div className="flex gap-3">
            <OptionButton active={!isDarkMode} onClick={() => setTheme(false)}>
              <span className="inline-flex items-center gap-2"><Sun className="w-4 h-4" /> Light</span>
            </OptionButton>
            <OptionButton active={isDarkMode} onClick={() => setTheme(true)}>
              <span className="inline-flex items-center gap-2"><Moon className="w-4 h-4" /> Dark</span>
            </OptionButton>
          </div>
        </CardContent>
      </Card>

      {/* Solver preferences */}
      <Card className="mb-6 border-2 border-blue-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <SlidersHorizontal className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Solver Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div>
            <p className="font-medium text-gray-800 dark:text-gray-200 mb-1">Angle unit</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              How trigonometry inputs like sin(30) are interpreted. Explicit notation (pi, °) always wins.
            </p>
            <div className="flex flex-wrap gap-3">
              {ANGLE_UNIT_OPTIONS.map((opt) => (
                <OptionButton
                  key={opt.value}
                  active={settings.angleUnit === opt.value}
                  title={opt.description}
                  onClick={() => updateSetting({ angleUnit: opt.value }, `Angle unit set to ${opt.label.toLowerCase()}`)}
                >
                  {opt.label}
                </OptionButton>
              ))}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {ANGLE_UNIT_OPTIONS.find((o) => o.value === settings.angleUnit)?.description}
            </p>
          </div>

          <div>
            <p className="font-medium text-gray-800 dark:text-gray-200 mb-1">Decimal places</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Precision for numeric results (e.g. sin(45°) = {(Math.SQRT2 / 2).toFixed(settings.decimalPlaces)}).
            </p>
            <div className="flex flex-wrap gap-3">
              {DECIMAL_OPTIONS.map((n) => (
                <OptionButton
                  key={n}
                  active={settings.decimalPlaces === n}
                  onClick={() => updateSetting({ decimalPlaces: n }, `Results will show up to ${n} decimal places`)}
                >
                  {n}
                </OptionButton>
              ))}
            </div>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
            Changes apply to newly solved problems.
          </p>
        </CardContent>
      </Card>

      {/* Data & privacy */}
      <Card className="mb-6 border-2 border-green-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <HardDrive className="w-6 h-6 text-green-600 dark:text-green-400" />
            Data & Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Your problem history lives entirely in this browser — no accounts, no cloud, no tracking.
          </p>
          <div className="flex flex-wrap gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="border-green-200 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40 hover:text-green-800 dark:hover:text-green-300 hover:border-green-300 dark:hover:border-green-600"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export All History
                  <ChevronDown className="w-4 h-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => handleExport("pdf")}>Export as PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("csv")}>Export as CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("json")}>Export as JSON</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("markdown")}>Export as Markdown</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              onClick={handleClearHistory}
              className="border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-300 hover:border-red-300 dark:hover:border-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear History
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card className="mb-6 border-2 border-teal-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2 dark:text-gray-100">
            <Info className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            About
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-800 dark:text-gray-200 font-medium mb-1">
            MasterMath v{pkg.version}
          </p>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            By sparkinCreations™ — master math with confidence.
          </p>
          <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 mb-4">
            <li>• Works fully offline — solutions are computed on your device</li>
            <li>• Powered by open-source math libraries, not AI</li>
            <li>• No accounts, no cloud, no tracking</li>
          </ul>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link to={createPageUrl("PrivacyPolicy")} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 underline decoration-indigo-300 dark:decoration-gray-600 hover:decoration-indigo-600 dark:hover:decoration-indigo-400">
              Privacy Policy
            </Link>
            <Link to={createPageUrl("TermsOfService")} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 underline decoration-indigo-300 dark:decoration-gray-600 hover:decoration-indigo-600 dark:hover:decoration-indigo-400">
              Terms of Service
            </Link>
            <Link to={createPageUrl("Feedback")} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 underline decoration-indigo-300 dark:decoration-gray-600 hover:decoration-indigo-600 dark:hover:decoration-indigo-400">
              Feedback & Support
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
