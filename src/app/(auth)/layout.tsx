import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

interface AuthLayoutProps {
  children: React.ReactNode;
}

/**
 * Auth layout - used for login/signup pages
 * Redirects authenticated users to the chat
 */
export default async function AuthLayout({ children }: AuthLayoutProps) {
  const session = await auth();

  // If user is already logged in, redirect to chat
  if (session?.user) {
    redirect("/chat");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.1),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(0,0,0,0))]" />

      {children}
    </div>
  );
}
