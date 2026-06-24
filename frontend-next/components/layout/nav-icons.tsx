function OntrackLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.5" />
      <path
        d="M8.5 15.5 L11.8 11.8 L15.5 8.5 L12.2 12.2 Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

const NAV_ICONS: Record<string, string> = {
  macro: "◈",
  calendar: "▦",
  schedule: "◷",
  recipes: "☰",
  products: "◫",
  summary: "¤",
  export: "↓",
};

export { OntrackLogo, NAV_ICONS };
