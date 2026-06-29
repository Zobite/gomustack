import { useEffect, useState } from "react";

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string>(() => {
    return localStorage.getItem("agent_hands_raw_api_key") || "";
  });

  const setApiKey = (val: string) => {
    setApiKeyState(val);
    localStorage.setItem("agent_hands_raw_api_key", val);
    // Dispatch storage event to sync with other instances/tabs
    window.dispatchEvent(new Event("storage"));
  };

  useEffect(() => {
    const handleStorageChange = () => {
      const storedKey = localStorage.getItem("agent_hands_raw_api_key") || "";
      if (storedKey !== apiKey) {
        setApiKeyState(storedKey);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [apiKey]);

  return [apiKey, setApiKey] as const;
}
