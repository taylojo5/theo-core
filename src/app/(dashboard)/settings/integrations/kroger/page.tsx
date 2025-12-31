"use client";
import { Button } from "@/components/ui";
import { useSearchParams } from "next/navigation";


export default function KrogerSettingsPage() {
  const searchParams = useSearchParams();

  function handleConnect() {
    // Redirect to the Kroger OAuth authorization URL
    window.location.href = "/api/integrations/kroger/connect";
  }

  return (
    <div>
      <h1>Kroger Settings</h1>
      <p>Connect your Kroger account to enable the Kroger integration.</p>
      {searchParams.get("oauth") === "success" ? (
        <p>Kroger account connected successfully.</p>
      ) : (
        <Button onClick={handleConnect}>Connect Kroger</Button>
      )}
    </div>
  );
}