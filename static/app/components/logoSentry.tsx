import {KNIGHT_BASE_PATH, KNIGHT_HEAD_PATH} from 'sentry/chessMode/assets/knight';

type Props = {
  className?: string;
  height?: string;
  showWordmark?: boolean;
};

// Pawn Patrol: the Sentry glyph + wordmark are replaced by the knight mark and
// the "Pawn Patrol" wordmark. Same component API, so every existing caller
// keeps working.
export function LogoSentry({showWordmark = true, height = '32px', className}: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={showWordmark ? '0 0 168 32' : '0 0 32 32'}
      height={height}
      className={className}
      fill="currentColor"
    >
      <path d={KNIGHT_BASE_PATH} />
      <path d={KNIGHT_HEAD_PATH} />
      {showWordmark && (
        <text
          x="40"
          y="24"
          fontSize="19"
          fontWeight="700"
          letterSpacing="-0.4"
          fill="currentColor"
        >
          Pawn Patrol
        </text>
      )}
    </svg>
  );
}
