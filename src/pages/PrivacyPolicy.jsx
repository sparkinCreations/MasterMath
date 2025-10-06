import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Database, Lock, Eye, Trash2, FileText } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function PrivacyPolicy() {
  usePageTitle("Privacy Policy - Your Privacy Matters");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          Privacy Policy
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Introduction */}
      <Card className="mb-6 border-2 border-purple-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-600" />
            Your Privacy Matters
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            At MasterMath by sparkinCreations™, we are committed to protecting your privacy.
            This Privacy Policy explains how we handle your information when you use our educational
            math application. We believe in transparency and want you to understand exactly how your
            data is managed.
          </p>
        </CardContent>
      </Card>

      {/* Data Collection */}
      <Card className="mb-6 border-2 border-blue-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-600" />
            What Information We Collect
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">
              Information Stored Locally on Your Device
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              MasterMath stores the following information locally in your browser using IndexedDB:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
              <li>Math problems you enter into the solver</li>
              <li>Solutions and explanations generated for your problems</li>
              <li>Timestamps of when you solved each problem</li>
              <li>Selected topic categories (e.g., Derivatives, Integrals, Algebra)</li>
              <li>Your dark mode preference</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">
              Information We Do NOT Collect
            </h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
              <li>We do NOT collect any personally identifiable information (name, email, phone number)</li>
              <li>We do NOT track your IP address or location</li>
              <li>We do NOT use cookies for tracking or advertising</li>
              <li>We do NOT share any data with third parties</li>
              <li>We do NOT send your data to any external servers</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* How We Use Data */}
      <Card className="mb-6 border-2 border-green-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-6 h-6 text-green-600" />
            How We Use Your Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-700 dark:text-gray-300 mb-3">
            All data stored by MasterMath remains on your device and is used solely to:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
            <li>Display your problem-solving history in the "My Progress" section</li>
            <li>Track your learning progress (total problems solved, weekly activity, topics covered)</li>
            <li>Allow you to review past solutions for study purposes</li>
            <li>Enable export functionality so you can save solutions for offline study</li>
            <li>Remember your display preferences (dark mode)</li>
          </ul>
        </CardContent>
      </Card>

      {/* Data Storage & Security */}
      <Card className="mb-6 border-2 border-indigo-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-6 h-6 text-indigo-600" />
            Data Storage and Security
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">
              Local Storage Only
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              MasterMath operates entirely within your browser. All your data is stored locally using
              IndexedDB technology, which is a secure, browser-based storage system. Your data never
              leaves your device unless you explicitly choose to export it.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">
              No Server Storage
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              Unlike many web applications, MasterMath does not use any backend servers or databases.
              We do not store, process, or have access to your data on any remote servers. This means
              your mathematical problems and solutions remain completely private to you.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* User Control */}
      <Card className="mb-6 border-2 border-rose-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="w-6 h-6 text-rose-600" />
            Your Control Over Your Data
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">
              Delete Your Data Anytime
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              You have complete control over your data and can delete it at any time:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
              <li>Use the "Clear History" button on the My Progress page to delete all stored problems and solutions</li>
              <li>Clear your browser data to remove all MasterMath information</li>
              <li>Uninstall or stop using the application - your data remains only on your device</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">
              Export Your Data
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              You can export your problem history and solutions at any time in multiple formats
              (PDF, CSV, JSON, Markdown) using the Export feature. This allows you to back up your
              learning progress or move it to another device.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Third-Party Services */}
      <Card className="mb-6 border-2 border-amber-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-amber-600" />
            Third-Party Services
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-700 dark:text-gray-300 mb-3">
            MasterMath uses the following third-party libraries to provide its functionality:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
            <li><strong>Math.js:</strong> For mathematical computations (runs locally in your browser)</li>
            <li><strong>Recharts:</strong> For graph visualization (runs locally in your browser)</li>
            <li><strong>jsPDF:</strong> For PDF export functionality (runs locally in your browser)</li>
          </ul>
          <p className="text-gray-700 dark:text-gray-300 mt-3">
            None of these libraries collect, transmit, or store your personal data.
          </p>
        </CardContent>
      </Card>

      {/* Children's Privacy */}
      <Card className="mb-6 border-2 border-teal-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-teal-600" />
            Children's Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-700 dark:text-gray-300">
            MasterMath is designed to be a safe educational tool for students of all ages. We do not
            knowingly collect any personal information from children or adults. Since all data is stored
            locally on the user's device and we do not have servers or databases, there is no collection
            of personal information that could identify a child or any user.
          </p>
        </CardContent>
      </Card>

      {/* Changes to Policy */}
      <Card className="mb-6 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-gray-600" />
            Changes to This Privacy Policy
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-700 dark:text-gray-300">
            We may update this Privacy Policy from time to time to reflect changes in our practices or
            for legal or regulatory reasons. When we make changes, we will update the "Last Updated" date
            at the top of this policy. We encourage you to review this policy periodically to stay informed
            about how we protect your privacy.
          </p>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card className="mb-6 border-2 border-purple-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-600" />
            Contact Us
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-700 dark:text-gray-300 mb-3">
            If you have any questions or concerns about this Privacy Policy or how MasterMath handles
            your information, please contact sparkinCreations:
          </p>
          <p className="text-gray-700 dark:text-gray-300">
            <strong>Website:</strong>{" "}
            <a
              href="https://sparkincreations.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 underline"
            >
              sparkincreations.com
            </a>
          </p>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 border-2 border-purple-200 dark:border-gray-700 rounded-xl p-6">
        <h3 className="font-bold text-xl text-gray-800 dark:text-gray-200 mb-3">Privacy Summary</h3>
        <ul className="space-y-2 text-gray-700 dark:text-gray-300">
          <li className="flex items-start gap-2">
            <span className="text-green-600 font-bold mt-1">✓</span>
            <span>All your data stays on your device - we have no servers</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 font-bold mt-1">✓</span>
            <span>We don't collect personal information</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 font-bold mt-1">✓</span>
            <span>You can delete your data anytime</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 font-bold mt-1">✓</span>
            <span>No tracking, no ads, no data sharing</span>
          </li>
        </ul>
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-gray-500 dark:text-gray-400">
        <p>MasterMath by sparkinCreations™</p>
        <p className="text-sm mt-1">Your privacy is our priority</p>
      </div>
    </div>
  );
}
