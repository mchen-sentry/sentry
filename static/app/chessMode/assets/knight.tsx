/**
 * Pawn Patrol knight mark.
 *
 * Drawn as a logomark rather than borrowed from a chess piece set: chess-set
 * knights are outlined artwork and dissolve into a soft blob when you fill them
 * as a solid silhouette at nav size. This one is built for 16-24px — a heavy
 * neck, a muzzle that projects with a horizontal mouth line, a wedge ear, and a
 * base plinth, all of which survive at the sizes it actually renders at.
 *
 * Both paths fill with `currentColor`, so the mark inherits whatever colour the
 * surrounding Sentry chrome is using in light and dark themes alike.
 */

/** Natural viewBox of the artwork. */
export const KNIGHT_VIEWBOX = '0 0 32 32';

/** The plinth the piece stands on. */
export const KNIGHT_BASE_PATH =
  'M4.5 27h23a1.6 1.6 0 0 1 1.6 1.6v0.8a1.6 1.6 0 0 1-1.6 1.6h-23a1.6 1.6 0 0 1-1.6-1.6v-0.8A1.6 1.6 0 0 1 4.5 27z';

/** Head and neck, drawn clockwise from the base of the mane. */
export const KNIGHT_HEAD_PATH =
  'M24.8 27 Q24.6 20 23.4 15.6 Q22.6 12.4 20.8 10.6 L22.9 3.5 L18.2 7.1 Q15.8 5.4 13.2 5.7 Q10.7 6 8.7 7.8 L4.7 11.8 Q2.4 13.6 2.9 14.6 Q3.4 15.8 5.7 15.9 L10.6 14.8 Q12.4 15.7 12.1 17.3 Q11.3 19.2 11.1 21.2 Q11 23.6 12.8 25.2 Q14 26.2 14.1 27 Z';

interface KnightMarkProps {
  className?: string;
  height?: string;
}

/** The knight on its own, as a standalone `<svg>`. */
export function KnightMark({className, height = '24px'}: KnightMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={KNIGHT_VIEWBOX}
      height={height}
      width={height}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <KnightPaths />
    </svg>
  );
}

/** The knight's paths only, for embedding in an existing `<svg>`. */
export function KnightPaths({transform}: {transform?: string}) {
  return (
    <g transform={transform} fill="currentColor">
      <path d={KNIGHT_BASE_PATH} />
      <path d={KNIGHT_HEAD_PATH} />
    </g>
  );
}
