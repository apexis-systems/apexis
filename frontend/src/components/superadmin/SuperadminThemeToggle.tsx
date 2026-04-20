"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

interface SuperadminThemeToggleProps {
  className?: string;
}

export default function SuperadminThemeToggle({
  className,
}: SuperadminThemeToggleProps) {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return localStorage.getItem("user-theme") === "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("user-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <button
      type="button"
      onClick={() => setDark((prev) => !prev)}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-lg border border-[hsl(35_15%_85%)] bg-[hsl(39_30%_97%)] text-[hsl(30_8%_45%)] shadow-sm transition-colors hover:bg-[hsl(37_18%_91%)] hover:text-[hsl(30_10%_15%)] dark:border-[hsl(30_8%_22%)] dark:bg-[hsl(30_8%_14%)] dark:text-[hsl(38_10%_55%)] dark:hover:bg-[hsl(30_6%_18%)] dark:hover:text-[hsl(38_20%_90%)]",
        className,
      )}
      aria-label="Toggle theme"
    >
      {dark ? <Sun className="h-4 w-4 text-[hsl(24_95%_53%)]" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
