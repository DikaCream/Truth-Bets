interface LogoProps {
  size?: number;
  withWordmark?: boolean;
}

/**
 * Brand mark: an ink ledger square split by two opposing chevrons — FALSE
 * falls (red, up-side) against TRUE rises (lime, down-side flip reads as the
 * spread of a wager). Flat, crisp, no glow.
 */
export default function Logo({ size = 30, withWordmark = true }: LogoProps) {
  return (
    <span className="logo">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <rect
          x="2"
          y="2"
          width="28"
          height="28"
          rx="8"
          fill="#12151a"
          stroke="rgba(255,255,255,0.25)"
        />
        {/* falling FALSE (red, top) — the side that loses */}
        <path
          d="M16 4v10M8 8l8-6 8 6"
          stroke="#ff5757"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* rising TRUE (lime, bottom) — the side that wins */}
        <path
          d="M16 18v10M8 24l8 6 8-6"
          stroke="#c8f169"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withWordmark && (
        <span className="logo-word">
          Truth <span>Bets</span>
        </span>
      )}
    </span>
  );
}