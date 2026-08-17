import {KNIGHT_BASE_PATH, KNIGHT_HEAD_PATH} from 'sentry/chessMode/assets/knight';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

// Pawn Patrol: the Sentry glyph is the knight mark. SvgIcon renders a 16x16
// viewBox and the artwork is drawn at 32x32, so it scales by half.
export function IconSentry(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <g transform="scale(0.5)">
        <path d={KNIGHT_BASE_PATH} />
        <path d={KNIGHT_HEAD_PATH} />
      </g>
    </SvgIcon>
  );
}
