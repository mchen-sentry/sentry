/**
 * Pawn Patrol knight mark.
 *
 * Silhouette derived from the Cburnett Wikimedia chess set (CC BY-SA 3.0) —
 * see LICENSE.md in this directory. The two paths are the piece's head and
 * body; filled in a single colour they union into a solid knight, which is what
 * reads at 16px in the nav.
 *
 * Everything fills with `currentColor`, so the mark inherits whatever colour
 * the surrounding Sentry chrome is using in light and dark themes alike.
 */

/** Natural viewBox of the source artwork. */
export const KNIGHT_VIEWBOX = '0 0 45 45';

export const KNIGHT_BODY_PATH =
  'M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18';

export const KNIGHT_HEAD_PATH =
  'M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10';

interface KnightMarkProps {
  className?: string;
  height?: string;
  /** Extra transform applied to the piece, e.g. to fit a different viewBox. */
  transform?: string;
}

/** The knight on its own, as a standalone `<svg>`. */
export function KnightMark({className, height = '32px'}: KnightMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={KNIGHT_VIEWBOX}
      height={height}
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
      <path d={KNIGHT_BODY_PATH} />
      <path d={KNIGHT_HEAD_PATH} />
    </g>
  );
}
