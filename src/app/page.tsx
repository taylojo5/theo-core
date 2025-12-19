import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Home page - redirects to chat or login
 */
export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect("/chat");
  } else {
    redirect("/login");
  }
}
