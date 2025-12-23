import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Documentation | Theo",
  description:
    "Interactive API documentation for Theo Core - Personal AI Assistant",
  openGraph: {
    title: "Theo API Documentation",
    description: "Interactive API reference for Theo Core",
    type: "website",
  },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Let Scalar control its own background - don't override
  return <>{children}</>;
}
