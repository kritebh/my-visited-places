"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { Button, Card } from "./ui";
import { useMediaQuery } from "@/lib/useMedia";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const installed = useMediaQuery("(display-mode: standalone)");
  const ios = useMediaQuery("(hover: none)") && typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (installed) return null;
  return (
    <Card className="space-y-2">
      <h2 className="flex items-center gap-2 font-semibold"><Smartphone className="size-4" /> Install the app</h2>
      {prompt ? (
        <Button
          onClick={async () => {
            await prompt.prompt();
            setPrompt(null);
          }}
        >
          Add to home screen
        </Button>
      ) : (
        <p className="text-sm text-ink-2">
          {ios ? "In Safari, tap Share → Add to Home Screen." : "Use your browser's menu → Install app / Add to home screen."}
        </p>
      )}
    </Card>
  );
}
