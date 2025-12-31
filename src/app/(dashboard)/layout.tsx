import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Dashboard layout - requires authentication
 * All routes under (dashboard) will require the user to be logged in
 */
export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <>{children}</>;
}
