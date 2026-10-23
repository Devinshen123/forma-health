import { useId, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { ALL_COMPANION_CHARACTERS, type LegacyCompanionCharacter, type CompanionCharacter, type CompanionItem } from '../companion';

import { companionPortrait, COMPANION_ART_VERSION } from '../companion-growth';

type Anchor = readonly [number, number, number];
type AccessoryAnchors = { hat: Anchor; neck: Anchor; pin: Anchor; flower: Anchor; crown: Anchor };

// Portraits are exported from the runtime's Pokémon-reference geometry.
// The version query bypasses older active workers that still cache the previous fixed art URLs.
const ART_VERSION = COMPANION_ART_VERSION;
const anchors: Record<LegacyCompanionCharacter, AccessoryAnchors> = {
  sprout: { hat: [121, 99, .72], neck: [120, 151, .95], pin: [79, 170, .85], flower: [166, 96, .62], crown: [124, 87, .62] },
  bunny: { hat: [124, 79, .62], neck: [120, 153, .82], pin: [77, 167, .8], flower: [174, 81, .65], crown: [124, 66, .64] },
  otter: { hat: [124, 55, .74], neck: [120, 145, .8], pin: [84, 164, .85], flower: [178, 65, .65], crown: [127, 44, .75] },
  cloud: { hat: [123, 76, .8], neck: [125, 145, .95], pin: [73, 164, .85], flower: [182, 95, .7], crown: [127, 52, .82] },
  bear: { hat: [123, 62, .75], neck: [120, 153, .83], pin: [84, 169, .85], flower: [181, 71, .65], crown: [125, 43, .72] },
  seal: { hat: [125, 58, .74], neck: [125, 136, .85], pin: [78, 158, .85], flower: [181, 62, .6], crown: [126, 43, .8] },
};

function at([x, y, scale]: Anchor, originalX: number, originalY: number) {
  return `translate(${x} ${y}) scale(${scale}) translate(${-originalX} ${-originalY})`;
}

type CompanionAvatarProps = {
  character?: CompanionCharacter;
  equipped?: CompanionItem | null;
  level?: number;
  label?: string;
  className?: string;
  thumbnail?: boolean;
  unavailableLabel?: string;
  retryKey?: number;
  onArtError?: () => void;
};

export default function CompanionAvatar(props: CompanionAvatarProps) {
  // A failed image never carries over to a newly chosen character or replaces it with another pet.
  return <CompanionArtwork key={`${props.character ?? 'sprout'}:${props.level ?? 1}:${Boolean(props.thumbnail)}:${props.retryKey ?? 0}`} {...props} />;
}

function CompanionArtwork({ character = 'sprout', equipped = null, level = 1, label, className = '', thumbnail = false, unavailableLabel = 'Image unavailable', onArtError }: CompanionAvatarProps) {
  const knownCharacter = (ALL_COMPANION_CHARACTERS as readonly string[]).includes(character);
  const [imageFailed, setImageFailed] = useState(false);
  const failed = !knownCharacter || imageFailed;
  const paintId = useId();
  const paint = `url(#${paintId})`;
  const position = anchors[character as LegacyCompanionCharacter] ?? anchors.sprout;
  const colors: Record<CompanionItem, [string, string]> = { leaf: ['#c7df9f', '#8ab85e'], cap: ['#e2f0f4', '#a9cbd8'], star: ['#fff0b4', '#e9c464'], scarf: ['#edd1bd', '#cca389'], flower: ['#f9e0d7', '#eab7a7'], crown: ['#fff0b4', '#e9c464'] };
  return <span className={`companion-avatar ${failed ? 'has-art-error' : ''} ${className}`} data-character={character} data-level={level} role={label ? 'img' : undefined} aria-label={label ? `${label}${failed ? ` · ${unavailableLabel}` : ''}` : undefined} aria-hidden={label ? undefined : true}>
    {failed ? <span className="companion-art-unavailable"><ImageOff size={23} /><span>{unavailableLabel}</span></span> : <img className="companion-avatar-art" src={`${companionPortrait(character, level, thumbnail)}${ART_VERSION}`} srcSet={`${companionPortrait(character, level, true)}${ART_VERSION} 192w, ${companionPortrait(character, level)}${ART_VERSION} 640w`} sizes={thumbnail ? '(max-width: 600px) 120px, 160px' : '(max-width: 600px) 215px, 260px'} alt="" width={thumbnail ? 192 : 640} height={thumbnail ? 192 : 640} loading={thumbnail ? 'lazy' : 'eager'} decoding="async" draggable={false} onError={() => { setImageFailed(true); onArtError?.(); }} />}
    {!failed && equipped ? <svg className="companion-avatar-accessory" viewBox="0 0 240 240" aria-hidden="true" focusable="false">
      <defs><linearGradient id={paintId} x1="0" y1="0" x2="1" y2="1"><stop stopColor={colors[equipped][0]} /><stop offset="1" stopColor={colors[equipped][1]} /></linearGradient></defs>
      {equipped === 'leaf' ? <g transform={at(position.pin, 76, 99)}><path d="M76 99c-14 2-23-8-22-18 14-1 24 6 22 18Z" fill={paint} stroke="#63864d" strokeWidth="1.5" /><path d="m62 88 13 11" stroke="#63864d" strokeWidth="1.3" /></g> : null}
      {equipped === 'cap' ? <g transform={at(position.hat, 100, 101)} fill={paint} stroke="#7698a6" strokeWidth="1.7"><path d="M69 101c2-24 17-35 39-30 19 4 26 16 24 31Z" /><path d="M72 101c-13-5-25-3-29 4 11 7 27 8 43 1" strokeLinejoin="round" /><path d="m100 75-5 23" fill="none" /></g> : null}
      {equipped === 'star' ? <g transform={at(position.pin, 144, 186)}><path d="m144 178 4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1Z" fill={paint} stroke="#b6984a" strokeWidth="1.3" strokeLinejoin="round" /></g> : null}
      {equipped === 'scarf' ? <g transform={at(position.neck, 120, 126)} fill={paint} stroke="#b48e72" strokeWidth="1.5"><path d="M66 115c25 9 83 10 108 0l-2 14c-27 10-77 10-104 0Z" /><path d="m151 132 18-3 6 32-15 7Z" /></g> : null}
      {equipped === 'flower' ? <g transform={`translate(${position.flower[0]} ${position.flower[1]}) scale(${position.flower[2]})`}><path d="M0-7c-12-19-25-2-13 8-13 13 2 26 12 13 15 14 28-2 14-13 12-14-5-27-13-8Z" fill={paint} stroke="#c99985" strokeWidth="1.5" /><circle r="7" cy="3" fill="#f7db83" stroke="#c99985" strokeWidth="1.2" /></g> : null}
      {equipped === 'crown' ? <g transform={at(position.crown, 121, 43)} fill={paint} stroke="#b6984a" strokeWidth="1.5" strokeLinejoin="round"><path d="m98 43-5-23 16 10 12-18 12 18 16-10-5 23Z" /><path d="M98 43h46v8H98Z" /></g> : null}
    </svg> : null}
  </span>;
}
