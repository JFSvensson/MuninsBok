import { useTheme, type Theme } from "../context/ThemeContext";
import styles from "./ThemeToggle.module.css";

const CYCLE: Theme[] = ["system", "dark", "light"];
const ICONS: Record<Theme, string> = {
  system: "\u{1F5A5}",
  dark: "\u{1F319}",
  light: "\u2600\uFE0F",
};
const LABELS: Record<Theme, string> = {
  system: "Systemtema",
  dark: "M\u00F6rkt tema",
  light: "Ljust tema",
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length]!;

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={() => setTheme(next)}
      aria-label={LABELS[theme]}
      title={LABELS[theme]}
    >
      {ICONS[theme]}
    </button>
  );
}
