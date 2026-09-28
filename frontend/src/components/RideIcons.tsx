import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

export function EconomyIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 120 80" fill="none" aria-hidden="true" {...props}>
      <path
        d="M26 55h68l-4-25c-.7-4-4.1-7-8.2-7H38.2c-4.1 0-7.5 3-8.2 7L26 55Z"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M21 55h78M31 55v8M89 55v8M39 34h42M43 43h34"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="38" cy="59" r="7" fill="currentColor" />
      <circle cx="82" cy="59" r="7" fill="currentColor" />
      <path
        d="M31 25 37 16h46l6 9M49 16v9M71 16v9"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ComfortIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 120 80" fill="none" aria-hidden="true" {...props}>
      <path
        d="M18 53h84l-7-20c-1.1-3.3-4.2-5.5-7.7-5.5H32.7c-3.5 0-6.6 2.2-7.7 5.5L18 53Z"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M14 53h92M25 53v8M95 53v8M33 37h54"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="34" cy="58" r="7" fill="currentColor" />
      <circle cx="86" cy="58" r="7" fill="currentColor" />
      <path
        d="M39 28 45 17h30l6 11M49 17v11M71 17v11"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M101 15v14M94 22h14M96 17l10 10M106 17 96 27"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ComfortPlusIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 120 80" fill="none" aria-hidden="true" {...props}>
      <path
        d="M14 53h92l-6-22c-1-3.5-4.2-6-7.9-6H27.9c-3.7 0-6.9 2.5-7.9 6L14 53Z"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M10 53h100M21 53v8M99 53v8M27 37h66M34 25l6-10h40l6 10M51 15v10M69 15v10"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="31" cy="58" r="7" fill="currentColor" />
      <circle cx="89" cy="58" r="7" fill="currentColor" />
      <path
        d="M101 12v17M92.5 20.5h17M95 14.5l12 12M107 14.5l-12 12"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function RideIcon({ type, ...props }: IconProps & {
  type: 'AUTO' | 'ECONOMY' | 'COMFORT' | 'COMFORT_PLUS';
}) {
  if (type === 'ECONOMY') return <EconomyIcon {...props} />;
  if (type === 'COMFORT') return <ComfortIcon {...props} />;
  return <ComfortPlusIcon {...props} />;
}
