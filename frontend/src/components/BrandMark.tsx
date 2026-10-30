interface BrandMarkProps {
  /** Use the light variant on dark backgrounds. */
  inverted?: boolean;
  size?: number;
}

export default function BrandMark({ inverted = false, size = 32 }: BrandMarkProps) {
  const bg = inverted ? '#ffffff' : '#000000';
  const fg = inverted ? '#000000' : '#ffffff';

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill={bg} />
      <path
        d="M19.5 8.5v10.25a4.75 4.75 0 0 1-9.5 0"
        stroke={fg}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="23.5" cy="23.5" r="2.25" fill="#05944f" />
    </svg>
  );
}
