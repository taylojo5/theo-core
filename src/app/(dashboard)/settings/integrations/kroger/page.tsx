"use client";
import { Button } from "@/components/ui";
import { KrogerStore } from "@prisma/client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function KrogerSettingsPage() {
  const [stores, setStores] = useState<KrogerStore[]>([]);
  const searchParams = useSearchParams();

  function handleConnect() {
    // Redirect to the Kroger OAuth authorization URL
    window.location.href = "/api/integrations/kroger/connect";
  }

  function handleSearchStores() {
    fetch(`/api/integrations/kroger/stores?zipCode=${72211}`)
      .then((response) => response.json())
      .then((data) => {
        setStores(data.data);
      });
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
      {searchParams.get("oauth") === "success" && (
        <Button
          onClick={() => {
            handleSearchStores();
          }}
        >
          Search Stores
        </Button>
      )}
      {stores.length > 0 && (
        <div>
          <h2>Stores</h2>
          <ul>
            {stores.map((store) => (
              <li key={store.id}>{store.name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
