import {KNIGHT_BODY_PATH, KNIGHT_HEAD_PATH} from 'sentry/chessMode/assets/knight';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

// Pawn Patrol: the Sentry glyph is the knight mark. SvgIcon renders a 16x16
// viewBox, so the 45x45 artwork is scaled down to fit.
export function IconSentry(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <g transform="scale(0.3556)">
        <path d={KNIGHT_BODY_PATH} />
        <path d={KNIGHT_HEAD_PATH} />
      </g>
    </SvgIcon>
  );
}
