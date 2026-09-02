interface LogoProps {
  size?: number;
  withWordmark?: boolean;
}

/**
 * Brand mark: a purple squircle holding a judgement beam with two coins — the
 * TRUE side (green) and the FALSE side (magenta) — balanced on an AI verdict.
 */
export default function Logo({ size = 30, withWordmark = true }: LogoProps) {
  return (
    <span className="logo" style={{ gap: 10 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="tb-brand" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#6d28d9" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="24" height="24" rx="7" fill="url(#tb-brand)" />
        <rect
          x="6.5"
          y="6.5"
          width="19"
          height="19"
          rx="5.5"
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth="1"
        />
        {/* judgement beam */}
        <path
          d="M16 4v9M12 8l4 4 4-4"
          stroke="#f4f1ea"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* the two sides */}
        <circle cx="9.5" cy="22.5" r="3.2" fill="#34d399" />
        <circle cx="22.5" cy="22.5" r="3.2" fill="#e879f9" />
      </svg>
      {withWordmark && (
        <span className="logo-word">
          Truth <span>Bets</span>
        </span>
      )}
    </span>
  );
}
