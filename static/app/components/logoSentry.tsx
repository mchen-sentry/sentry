import {KNIGHT_BODY_PATH, KNIGHT_HEAD_PATH} from 'sentry/chessMode/assets/knight';

type Props = {
  className?: string;
  height?: string;
  showWordmark?: boolean;
};

// Pawn Patrol: the Sentry glyph + wordmark are replaced by the knight mark and
// the "Pawn Patrol" wordmark. Same component API, same viewBox proportions, so
// every existing caller keeps working.
export function LogoSentry({showWordmark = true, height = '32px', className}: Props) {
  const knight = (
    <g>
      <path d={KNIGHT_BODY_PATH} />
      <path d={KNIGHT_HEAD_PATH} />
    </g>
  );

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={showWordmark ? '0 0 210 45' : '0 0 45 45'}
      height={height}
      className={className}
      fill="currentColor"
    >
      {knight}
      {showWordmark && (
        <text
          x="52"
          y="33"
          fontSize="26"
          fontWeight="700"
          letterSpacing="-0.5"
          fill="currentColor"
        >
          Pawn Patrol
        </text>
      )}
    </svg>
  );
}
