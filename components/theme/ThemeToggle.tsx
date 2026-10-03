"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "@/components/theme/ThemeProvider";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      className="ui-btn ui-btn-secondary h-8 w-8 p-0"
      aria-label="Тема"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
