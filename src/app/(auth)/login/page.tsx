"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function GoogleIcon() {
  return (
    <svg
      className="mr-2 h-4 w-4"
      aria-hidden="true"
      focusable="false"
      data-prefix="fab"
      data-icon="google"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 488 512"
    >
      <path
        fill="currentColor"
        d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
      />
    </svg>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/chat";
  const error = searchParams.get("error");

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl });
  };

  return (
    <div className="w-full max-w-md px-4">
      {/* Logo and Title */}
      <div className="mb-8 text-center">
        <div className="bg-primary text-primary-foreground mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl text-3xl font-bold shadow-lg">
          θ
        </div>
        <h1 className="text-foreground text-3xl font-bold tracking-tight">
          Welcome to Theo
        </h1>
        <p className="text-muted-foreground mt-2">
          Your context-aware AI assistant
        </p>
      </div>

      {/* Login Card */}
      <Card className="bg-card/80 border-0 shadow-xl backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-center text-xl">Sign in</CardTitle>
          <CardDescription className="text-center">
            Continue with your Google account to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="text-destructive bg-destructive/10 rounded-lg p-3 text-center text-sm">
              {error === "OAuthAccountNotLinked"
                ? "This email is already associated with another account."
                : "An error occurred during sign in. Please try again."}
            </div>
          )}

          <Button
            variant="outline"
            className="hover:bg-accent h-11 w-full text-base font-medium transition-colors"
            onClick={handleGoogleSignIn}
          >
            <GoogleIcon />
            Continue with Google
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card text-muted-foreground px-2">
                Secure authentication
              </span>
            </div>
          </div>

          <p className="text-muted-foreground text-center text-xs">
            By signing in, you agree to our Terms of Service and Privacy Policy.
            Your data is encrypted and never shared.
          </p>
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="text-muted-foreground mt-8 text-center text-sm">
        Theo learns and grows with you, understanding your world to help you
        take the next right step.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md animate-pulse px-4">
          <div className="bg-muted mx-auto mb-4 h-16 w-16 rounded-2xl" />
          <div className="bg-muted mx-auto mb-2 h-8 w-48 rounded" />
          <div className="bg-muted mx-auto h-4 w-64 rounded" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
