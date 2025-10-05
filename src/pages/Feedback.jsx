import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MessageSquare, Send, Bug, Lightbulb, AlertTriangle, Star } from "lucide-react";
import { useToast } from "@/components/ui/toast";

const FEEDBACK_TYPES = [
  { value: "bug", label: "Bug Report", icon: Bug, color: "text-red-600" },
  { value: "accuracy", label: "Accuracy Issue", icon: AlertTriangle, color: "text-yellow-600" },
  { value: "feature", label: "Feature Request", icon: Lightbulb, color: "text-blue-600" },
  { value: "general", label: "General Feedback", icon: MessageSquare, color: "text-green-600" },
  { value: "praise", label: "Positive Feedback", icon: Star, color: "text-purple-600" }
];

const MATH_TOPICS = [
  "Derivatives",
  "Integrals", 
  "Limits",
  "Algebra",
  "Trigonometry",
  "Functions",
  "Arithmetic",
  "General/Other"
];

export default function Feedback() {
  const [feedbackType, setFeedbackType] = useState("");
  const [mathTopic, setMathTopic] = useState("");
  const [problem, setProblem] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Format feedback data
      const feedbackData = {
        type: feedbackType,
        mathTopic,
        problem,
        expected,
        actual,
        description,
        email,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      // Create email body
      const emailBody = `
MathMaster Feedback Report
=========================

Type: ${FEEDBACK_TYPES.find(t => t.value === feedbackType)?.label || feedbackType}
Math Topic: ${mathTopic}
Timestamp: ${new Date().toLocaleString()}

${problem ? `Problem/Question:\n${problem}\n\n` : ''}
${expected ? `Expected Result:\n${expected}\n\n` : ''}
${actual ? `Actual Result:\n${actual}\n\n` : ''}

Description:
${description}

${email ? `User Email: ${email}\n\n` : ''}

Technical Information:
- User Agent: ${navigator.userAgent}
- Page URL: ${window.location.href}
- Timestamp: ${feedbackData.timestamp}
      `.trim();

      // Create mailto link
      const subject = `[MathMaster] ${FEEDBACK_TYPES.find(t => t.value === feedbackType)?.label || 'Feedback'}`;
      const mailtoLink = `mailto:admin@sparkincreations.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
      
      // Open email client
      window.location.href = mailtoLink;

      // Store feedback locally for user reference
      const localFeedback = JSON.parse(localStorage.getItem('mathmaster-feedback') || '[]');
      localFeedback.push({
        ...feedbackData,
        id: Date.now(),
        status: 'sent'
      });
      localStorage.setItem('mathmaster-feedback', JSON.stringify(localFeedback));

      // Reset form
      setFeedbackType("");
      setMathTopic("");
      setProblem("");
      setExpected("");
      setActual("");
      setDescription("");
      setEmail("");

      toast.success("Feedback email opened! Thank you for helping improve MathMaster.");
      
    } catch (error) {
      console.error("Error processing feedback:", error);
      toast.error("Error processing feedback. Please try again or email us directly at admin@sparkincreations.com");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedType = FEEDBACK_TYPES.find(t => t.value === feedbackType);
  const isAccuracyIssue = feedbackType === "accuracy" || feedbackType === "bug";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          Feedback & Support
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Help us improve MathMaster by sharing your experience, reporting issues, or suggesting new features.
        </p>
      </div>

      <Card className="border-2 border-purple-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-700">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-purple-600" />
            Send Feedback
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Feedback Type */}
            <div>
              <Label htmlFor="feedback-type" className="text-sm font-medium mb-2 block">
                Feedback Type *
              </Label>
              <Select value={feedbackType} onValueChange={setFeedbackType} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select feedback type..." />
                </SelectTrigger>
                <SelectContent>
                  {FEEDBACK_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className={`w-4 h-4 ${type.color}`} />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Math Topic */}
            {feedbackType && (
              <div>
                <Label htmlFor="math-topic" className="text-sm font-medium mb-2 block">
                  Math Topic {isAccuracyIssue ? "*" : "(Optional)"}
                </Label>
                <Select value={mathTopic} onValueChange={setMathTopic} required={isAccuracyIssue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select math topic..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MATH_TOPICS.map((topic) => (
                      <SelectItem key={topic} value={topic}>
                        {topic}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Problem/Question */}
            {isAccuracyIssue && (
              <div>
                <Label htmlFor="problem" className="text-sm font-medium mb-2 block">
                  Problem/Question *
                </Label>
                <Textarea
                  id="problem"
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  placeholder="Enter the exact problem you entered into MathMaster..."
                  className="min-h-[80px]"
                  required
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Please include the exact mathematical expression you entered.
                </p>
              </div>
            )}

            {/* Expected vs Actual Results */}
            {feedbackType === "accuracy" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="expected" className="text-sm font-medium mb-2 block">
                    Expected Result
                  </Label>
                  <Textarea
                    id="expected"
                    value={expected}
                    onChange={(e) => setExpected(e.target.value)}
                    placeholder="What should the correct answer be?"
                    className="min-h-[100px]"
                  />
                </div>
                <div>
                  <Label htmlFor="actual" className="text-sm font-medium mb-2 block">
                    Actual Result *
                  </Label>
                  <Textarea
                    id="actual"
                    value={actual}
                    onChange={(e) => setActual(e.target.value)}
                    placeholder="What did MathMaster show?"
                    className="min-h-[100px]"
                    required
                  />
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <Label htmlFor="description" className="text-sm font-medium mb-2 block">
                {feedbackType === "feature" ? "Feature Description *" : 
                 feedbackType === "bug" ? "Bug Description *" :
                 feedbackType === "praise" ? "What did you like? *" :
                 "Additional Details *"}
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  feedbackType === "feature" ? "Describe the feature you'd like to see..." :
                  feedbackType === "bug" ? "Describe what happened and steps to reproduce..." :
                  feedbackType === "accuracy" ? "Explain the accuracy issue in detail..." :
                  feedbackType === "praise" ? "Tell us what you enjoyed about MathMaster..." :
                  "Share your feedback, suggestions, or questions..."
                }
                className="min-h-[120px]"
                required
              />
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email" className="text-sm font-medium mb-2 block">
                Email (Optional)
              </Label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Include your email if you'd like a response. We respect your privacy and won't share your email.
              </p>
            </div>

            {/* Privacy Notice */}
            <div className="bg-blue-50 dark:bg-gray-700 border border-blue-200 dark:border-gray-600 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Privacy Notice</h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Your feedback will be sent via your default email client to admin@sparkincreations.com. 
                We store feedback locally on your device for your reference. We don't collect or share 
                personal information beyond what you choose to include in your feedback.
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={!feedbackType || !description || isSubmitting}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4 mr-2" />
                {isSubmitting ? "Processing..." : "Send Feedback"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Additional Information */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-2 border-green-200 dark:border-gray-700">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-700 dark:to-gray-700">
            <CardTitle className="text-green-800 dark:text-green-100">Quick Tips</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li>• Be specific about mathematical expressions when reporting accuracy issues</li>
              <li>• Include steps to reproduce bugs</li>
              <li>• Check our User Manual before reporting known limitations</li>
              <li>• Remember to verify solutions independently</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-200 dark:border-gray-700">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-gray-700 dark:to-gray-700">
            <CardTitle className="text-blue-800 dark:text-blue-100">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <p><strong>Email:</strong> admin@sparkincreations.com</p>
              <p><strong>Website:</strong> sparkincreations.com</p>
              <p><strong>Response Time:</strong> 1-3 business days</p>
              <p><strong>Open Source:</strong> GitHub Issues welcome</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}