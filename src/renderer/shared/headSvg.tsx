import { renderToStaticMarkup } from 'react-dom/server';
import type { Character } from '../../core/character';
import { CharacterSvg, HEAD_VIEWBOX } from './CharacterSvg';

export { HEAD_VIEWBOX };

/** Standalone SVG string of the character's head (no shirt/hands/animation), e.g. for rasterising tray icons. */
export function characterHeadSvg(c: Character): string {
  return renderToStaticMarkup(<CharacterSvg character={c} pose="rise" animate={false} variant="head" />);
}
