import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Scale, BookOpen, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function TermsOfService() {
  usePageTitle("Terms of Service - Usage Guidelines");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          Terms of Service
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Introduction */}
      <Card className="mb-6 border-2 border-purple-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <Scale className="w-6 h-6 text-purple-600" />
            Agreement to Terms
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            Welcome to MasterMath by sparkinCreations™. By accessing or using our educational math
            application, you agree to be bound by these Terms of Service. If you do not agree to
            these terms, please do not use MasterMath.
          </p>
        </CardContent>
      </Card>

      {/* Description of Service */}
      <Card className="mb-6 border-2 border-blue-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            Description of Service
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">
              What MathMaster Provides
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              MasterMath is an educational tool designed to help students learn and understand
              precalculus and calculus concepts. The service provides:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
              <li>Step-by-step solutions to mathematical problems</li>
              <li>Educational explanations and insights</li>
              <li>Graph visualizations for applicable problems</li>
              <li>Progress tracking and history features</li>
              <li>Export functionality for solutions and progress data</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">
              Educational Purpose Only
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              MasterMath is intended as a learning aid to help students understand mathematical
              concepts. It should be used to supplement, not replace, traditional learning methods
              and instruction from qualified educators.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Acceptable Use */}
      <Card className="mb-6 border-2 border-green-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-green-600" />
            Acceptable Use
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">
              You May:
            </h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>Use MasterMath for personal educational purposes</li>
              <li>Input mathematical problems to receive step-by-step solutions</li>
              <li>Export your solutions and progress for personal study and reference</li>
              <li>Use the application to learn and understand mathematical concepts</li>
              <li>Share knowledge gained from MasterMath with others</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Prohibited Use */}
      <Card className="mb-6 border-2 border-red-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <XCircle className="w-6 h-6 text-red-600" />
            Prohibited Use
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">
              You May NOT:
            </h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li>Use MasterMath to cheat on exams, tests, or assignments without understanding the material</li>
              <li>Submit MasterMath solutions as your own work without proper attribution when required</li>
              <li>Attempt to reverse engineer, decompile, or extract source code from the application</li>
              <li>Use the service for any illegal or unauthorized purpose</li>
              <li>Attempt to interfere with or disrupt the service's functionality</li>
              <li>Remove, obscure, or alter any copyright, trademark, or proprietary notices</li>
              <li>Use automated systems to access the service excessively or abusively</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Academic Integrity */}
      <Card className="mb-6 border-2 border-amber-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
            Academic Integrity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-700 dark:text-gray-300 mb-3">
            <strong>Important:</strong> MasterMath is designed as a learning tool. Users are
            responsible for adhering to their institution's academic integrity policies and honor codes.
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
            <li>Always attempt problems yourself before seeking solutions</li>
            <li>Use solutions to understand the process, not just copy answers</li>
            <li>Consult your instructor about appropriate use of educational tools</li>
            <li>Follow your school's policies regarding homework help and study aids</li>
            <li>Be honest about when and how you use MasterMath for academic work</li>
          </ul>
          <p className="text-gray-700 dark:text-gray-300 mt-3">
            sparkinCreations is not responsible for any academic integrity violations resulting
            from misuse of MasterMath.
          </p>
        </CardContent>
      </Card>

      {/* Accuracy Disclaimer */}
      <Card className="mb-6 border-2 border-yellow-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-yellow-600" />
            Accuracy Disclaimer - Verify Your Sources
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">
              Always Check Your Work
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              <strong>Important:</strong> MasterMath is an educational aid that may contain errors or 
              inaccuracies. Users are strongly advised to verify all information independently.
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li><strong>Step-by-step solutions</strong> may contain calculation errors or incorrect methodology</li>
              <li><strong>Final answers</strong> should be double-checked using alternative methods or sources</li>
              <li><strong>Graphs and visualizations</strong> may not accurately represent the mathematical functions</li>
              <li><strong>Tips and explanations</strong> may contain oversimplifications or inaccuracies</li>
              <li><strong>Mathematical interpretations</strong> may not align with your curriculum or textbook</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">
              Recommended Verification Methods
            </h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
              <li>Cross-reference solutions with textbooks and class materials</li>
              <li>Use multiple mathematical tools or calculators for comparison</li>
              <li>Consult with instructors, tutors, or peers</li>
              <li>Practice problems using established mathematical methods</li>
              <li>Verify graphs using graphing calculators or other software</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* No Warranty */}
      <Card className="mb-6 border-2 border-orange-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
            No Warranty - Use at Your Own Risk
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">
              As-Is Service
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              MasterMath is provided "AS IS" and "AS AVAILABLE" without warranties of any kind,
              either express or implied. While we strive for accuracy, we do not guarantee that:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4 mt-2">
              <li>All solutions will be 100% accurate</li>
              <li>The service will be uninterrupted or error-free</li>
              <li>All bugs or errors will be corrected</li>
              <li>The service will meet your specific requirements</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">
              No Responsibility for Inaccurate Data
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              sparkinCreations explicitly disclaims responsibility for any inaccurate, incomplete, 
              or misleading information provided by MathMaster, including but not limited to:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
              <li>Mathematical calculations and step-by-step solutions</li>
              <li>Final answers and results</li>
              <li>Graph visualizations and plotting accuracy</li>
              <li>Educational explanations and mathematical interpretations</li>
              <li>Tips, suggestions, and learning recommendations</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mt-3">
              Users should always verify solutions and understand the methodology. MathMaster is
              an educational aid, not a substitute for learning or professional mathematical advice.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Limitation of Liability */}
      <Card className="mb-6 border-2 border-indigo-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <Scale className="w-6 h-6 text-indigo-600" />
            Limitation of Liability
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-700 dark:text-gray-300 mb-3">
            To the maximum extent permitted by law, sparkinCreations shall not be liable for any
            indirect, incidental, special, consequential, or punitive damages, or any loss of profits
            or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill,
            or other intangible losses resulting from:
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
            <li>Your use or inability to use MathMaster</li>
            <li>Any inaccuracies in solutions, step-by-step processes, or explanations provided</li>
            <li>Incorrect final answers or mathematical results</li>
            <li>Inaccurate graphs, visualizations, or mathematical representations</li>
            <li>Academic consequences resulting from use of the service</li>
            <li>Reliance on MathMaster's output without independent verification</li>
            <li>Any data loss or corruption</li>
            <li>Any other matter relating to the service</li>
          </ul>
          <p className="text-gray-700 dark:text-gray-300 mt-3">
            <strong>By using MathMaster, you acknowledge that you understand the service may contain 
            errors and agree to independently verify all mathematical information before relying on it 
            for academic, professional, or personal purposes.</strong>
          </p>
        </CardContent>
      </Card>

      {/* Intellectual Property */}
      <Card className="mb-6 border-2 border-teal-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-teal-600" />
            Intellectual Property
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">
              Our Rights
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              MathMaster, including its design, code, features, and content, is owned by
              sparkinCreations and is protected by copyright, trademark, and other intellectual
              property laws.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">
              Your Content
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              You retain all rights to the mathematical problems you input into MathMaster. By using
              the service, you grant us permission to process your inputs solely for the purpose of
              providing solutions and maintaining the service functionality on your local device.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Modifications to Service */}
      <Card className="mb-6 border-2 border-violet-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-violet-600" />
            Modifications to Service and Terms
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">
              Service Changes
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              We reserve the right to modify, suspend, or discontinue MathMaster (or any part thereof)
              at any time without notice. We shall not be liable to you or any third party for any
              modification, suspension, or discontinuance of the service.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">
              Pricing and Features
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              All current features of MasterMath are provided at no cost. If we introduce premium
              features in the future, all existing features will remain free. Any pricing changes or
              new paid features will be clearly communicated in advance, and you will never be charged
              for features that were previously free.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">
              Terms Updates
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
              We may update these Terms of Service from time to time. When we do, we will revise
              the "Last Updated" date at the top of this page. Your continued use of MathMaster
              after any changes constitutes acceptance of the new terms.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Termination */}
      <Card className="mb-6 border-2 border-rose-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <XCircle className="w-6 h-6 text-rose-600" />
            Termination
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-700 dark:text-gray-300">
            You may stop using MathMaster at any time. Since all data is stored locally on your device,
            you can simply clear your browser data or stop accessing the application. We reserve the
            right to refuse service to anyone for any reason at any time, though as a client-side
            application, enforcement is limited.
          </p>
        </CardContent>
      </Card>

      {/* Governing Law */}
      <Card className="mb-6 border-2 border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <Scale className="w-6 h-6 text-slate-600" />
            Governing Law
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-700 dark:text-gray-300">
            These Terms shall be governed by and construed in accordance with applicable laws,
            without regard to conflict of law provisions. Any disputes arising from these terms
            or your use of MathMaster shall be resolved in accordance with the laws of the
            jurisdiction where sparkinCreations operates.
          </p>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card className="mb-6 border-2 border-purple-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-purple-600" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-700 dark:text-gray-300 mb-3">
            If you have any questions about these Terms of Service, please contact sparkinCreations:
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
        <h3 className="font-bold text-xl text-gray-800 dark:text-gray-200 mb-3">Terms Summary</h3>
        <ul className="space-y-2 text-gray-700 dark:text-gray-300">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold mt-1">•</span>
            <span>MasterMath is an educational tool - use it to learn, not to cheat</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-600 font-bold mt-1">⚠</span>
            <span><strong>Always verify solutions independently</strong> - we are not responsible for inaccurate data including step-by-step solutions, final results, or graphs</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold mt-1">•</span>
            <span>Solutions are provided as-is; always understand the process and check your work</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold mt-1">•</span>
            <span>Respect academic integrity policies at your institution</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 font-bold mt-1">•</span>
            <span>You own your data; we don't collect or share it</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-orange-600 font-bold mt-1">⚠</span>
            <span>Cross-reference with textbooks, instructors, and other mathematical tools</span>
          </li>
        </ul>
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-gray-500 dark:text-gray-400">
        <p>MasterMath by sparkinCreations™</p>
        <p className="text-sm mt-1">Master math with confidence</p>
      </div>
    </div>
  );
}
