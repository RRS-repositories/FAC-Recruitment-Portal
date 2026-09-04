/**
 * Client wordmarks used in the "trusted by" marquee.
 *
 * Each mark is inline SVG (no network request, crisp at any size, themeable).
 * Consumers decide accessibility: the visible set passes `role="img"` with the
 * name, the duplicated set used to make the marquee seamless is aria-hidden so
 * a screen reader hears each client once.
 */

const NAVY = '#0c1a3a';
const GOLD = '#d4a84b';
const GOLD_MUTED = '#8a7a55';

function RowanRose(props) {
  return (
    <svg viewBox="0 0 260 60" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g transform="translate(6,8)">
        <path
          d="M22 2c-6 6-9 12-9 20 0 8 4 14 9 20 5-6 9-12 9-20 0-8-3-14-9-20z"
          fill={NAVY}
        />
        <path d="M22 10c-3 4-4 8-4 12s1 8 4 12c3-4 4-8 4-12s-1-8-4-12z" fill={GOLD} />
      </g>
      <text
        x="60"
        y="30"
        fontFamily="Playfair Display,Georgia,serif"
        fontWeight="700"
        fontSize="22"
        fill={NAVY}
        letterSpacing="-.3"
      >
        Rowan Rose
      </text>
      <text
        x="61"
        y="46"
        fontFamily="Inter,Arial,sans-serif"
        fontWeight="600"
        fontSize="9"
        letterSpacing="3.5"
        fill={GOLD_MUTED}
      >
        SOLICITORS
      </text>
    </svg>
  );
}

function FastActionClaims(props) {
  return (
    <svg viewBox="0 0 300 60" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g transform="translate(6,10)">
        <rect width="40" height="40" rx="8" fill={NAVY} />
        <path
          d="M12 30L20 20 12 10M24 30L32 20 24 10"
          stroke={GOLD}
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <text
        x="58"
        y="27"
        fontFamily="Inter,Arial,sans-serif"
        fontWeight="800"
        fontSize="19"
        fill={NAVY}
        letterSpacing="-.5"
      >
        FAST ACTION
      </text>
      <text
        x="58"
        y="47"
        fontFamily="Inter,Arial,sans-serif"
        fontWeight="800"
        fontSize="19"
        fill={GOLD}
        letterSpacing="-.5"
      >
        CLAIMS
      </text>
    </svg>
  );
}

function BeaconLegalGroup(props) {
  return (
    <svg viewBox="0 0 300 60" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g transform="translate(6,6)">
        <path d="M24 4l-8 10h16z" fill={GOLD} />
        <rect x="18" y="14" width="12" height="24" fill={NAVY} />
        <rect x="10" y="38" width="28" height="6" rx="2" fill={NAVY} />
        <path
          d="M4 12l8 4M44 12l-8 4M2 24h8M46 24h-8"
          stroke={GOLD}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      <text
        x="60"
        y="30"
        fontFamily="Playfair Display,Georgia,serif"
        fontWeight="600"
        fontSize="21"
        fill={NAVY}
      >
        Beacon
      </text>
      <text
        x="60"
        y="47"
        fontFamily="Inter,Arial,sans-serif"
        fontWeight="500"
        fontSize="11"
        letterSpacing="2.5"
        fill={GOLD_MUTED}
      >
        LEGAL GROUP
      </text>
    </svg>
  );
}

function EvolveCrm(props) {
  return (
    <svg viewBox="0 0 240 60" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g transform="translate(6,10)">
        <circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          stroke={NAVY}
          strokeWidth="3"
          strokeDasharray="80 40"
          strokeLinecap="round"
        />
        <path d="M30 6l6-2-2 6" fill={GOLD} />
        <circle cx="20" cy="20" r="6" fill={GOLD} />
      </g>
      <text
        x="56"
        y="38"
        fontFamily="Inter,Arial,sans-serif"
        fontWeight="700"
        fontSize="26"
        fill={NAVY}
        letterSpacing="-1"
      >
        evolve
        <tspan fill={GOLD} fontWeight="400">
          crm
        </tspan>
      </text>
    </svg>
  );
}

function ConsumerReclaim(props) {
  return (
    <svg viewBox="0 0 300 60" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g transform="translate(6,8)">
        <path d="M22 2l18 8v12c0 11-8 18-18 22-10-4-18-11-18-22V10z" fill={NAVY} />
        <path
          d="M13 22l6 6 12-12"
          stroke={GOLD}
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <text x="56" y="27" fontFamily="Inter,Arial,sans-serif" fontWeight="700" fontSize="18" fill={NAVY}>
        Consumer
      </text>
      <text x="56" y="47" fontFamily="Inter,Arial,sans-serif" fontWeight="700" fontSize="18" fill={GOLD}>
        Reclaim
      </text>
    </svg>
  );
}

function HelpYouReclaim(props) {
  return (
    <svg viewBox="0 0 300 60" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g transform="translate(6,8)">
        <circle cx="22" cy="22" r="20" fill={GOLD} />
        <path
          d="M22 34c-6-4-12-9-12-15a6 6 0 0112-2 6 6 0 0112 2c0 6-6 11-12 15z"
          fill={NAVY}
        />
      </g>
      <text x="56" y="27" fontFamily="Inter,Arial,sans-serif" fontWeight="600" fontSize="18" fill={NAVY}>
        Help You
      </text>
      <text x="56" y="47" fontFamily="Inter,Arial,sans-serif" fontWeight="800" fontSize="18" fill={NAVY}>
        Reclaim<tspan fill={GOLD}>.</tspan>
      </text>
    </svg>
  );
}

function TreadstoneAdvisory(props) {
  return (
    <svg viewBox="0 0 300 60" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g transform="translate(6,8)">
        <rect x="4" y="4" width="36" height="36" fill="none" stroke={NAVY} strokeWidth="3" />
        <rect x="12" y="12" width="20" height="20" fill={NAVY} />
        <rect x="18" y="18" width="8" height="8" fill={GOLD} />
      </g>
      <text
        x="56"
        y="30"
        fontFamily="Playfair Display,Georgia,serif"
        fontWeight="600"
        fontSize="20"
        fill={NAVY}
        letterSpacing=".5"
      >
        TREADSTONE
      </text>
      <text
        x="57"
        y="46"
        fontFamily="Inter,Arial,sans-serif"
        fontWeight="500"
        fontSize="10"
        letterSpacing="3"
        fill={GOLD_MUTED}
      >
        ADVISORY
      </text>
    </svg>
  );
}

function CapitalInvestments(props) {
  return (
    <svg viewBox="0 0 300 60" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g transform="translate(6,8)">
        <rect x="4" y="26" width="8" height="14" fill={NAVY} />
        <rect x="16" y="18" width="8" height="22" fill={NAVY} />
        <rect x="28" y="10" width="8" height="30" fill={GOLD} />
        <path d="M4 22L20 10 40 2" stroke={NAVY} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>
      <text
        x="56"
        y="27"
        fontFamily="Playfair Display,Georgia,serif"
        fontWeight="700"
        fontSize="19"
        fill={NAVY}
      >
        Capital
      </text>
      <text
        x="56"
        y="46"
        fontFamily="Inter,Arial,sans-serif"
        fontWeight="500"
        fontSize="11"
        letterSpacing="2"
        fill={GOLD_MUTED}
      >
        INVESTMENTS
      </text>
    </svg>
  );
}

export const clientLogos = [
  { id: 'rowan-rose', name: 'Rowan Rose Solicitors', Mark: RowanRose },
  { id: 'fast-action', name: 'Fast Action Claims', Mark: FastActionClaims },
  { id: 'beacon', name: 'Beacon Legal Group', Mark: BeaconLegalGroup },
  { id: 'evolve-crm', name: 'Evolve CRM', Mark: EvolveCrm },
  { id: 'consumer-reclaim', name: 'Consumer Reclaim', Mark: ConsumerReclaim },
  { id: 'help-you-reclaim', name: 'Help You Reclaim', Mark: HelpYouReclaim },
  { id: 'treadstone', name: 'Treadstone Advisory', Mark: TreadstoneAdvisory },
  { id: 'capital', name: 'Capital Investments', Mark: CapitalInvestments },
];

export default clientLogos;
