import { useId } from 'react';
import type { CompanionItem } from '../companion';

/** Original Forma geometry: a friendly sprout in a little rounded planter. */
export default function CompanionAvatar({ equipped = null, level = 1, label, className = '' }: { equipped?: CompanionItem | null; level?: number; label?: string; className?: string }) {
  const title = useId();
  return <svg className={`companion-avatar ${className}`} viewBox="0 0 240 240" role={label ? 'img' : undefined} aria-labelledby={label ? title : undefined} aria-hidden={label ? undefined : true} focusable="false">
    {label ? <title id={title}>{label}</title> : null}
    <ellipse cx="120" cy="210" rx="65" ry="9" fill="#e7eddf" />
    <path d="M80 183c-13 0-21 9-15 15 6 6 24 3 30-4m65-11c13 0 21 9 15 15-6 6-24 3-30-4" fill="#c5dfaa" stroke="#42573c" strokeWidth="3" strokeLinecap="round" />
    <path d="M117 104c-6-17-5-33 4-51" fill="none" stroke="#63884a" strokeWidth="7" strokeLinecap="round" />
    <path d="M117 83C88 87 73 67 78 49c23-1 43 9 39 34Z" fill="#c5f467" stroke="#63884a" strokeWidth="3" />
    <path d="M120 68c-3-22 13-40 34-41 6 21-9 44-34 41Z" fill="#a7d775" stroke="#63884a" strokeWidth="3" />
    {level >= 4 ? <path d="M123 96c15-21 35-19 45-9-10 19-29 22-45 9Z" fill="#d8edbf" stroke="#63884a" strokeWidth="3" /> : null}
    {level >= 8 ? <path d="M113 99c-20-10-36-5-40 9 17 12 34 7 40-9Z" fill="#d8edbf" stroke="#63884a" strokeWidth="3" /> : null}
    <path d="M59 115c0-13 12-22 26-22h70c14 0 26 9 26 22l-8 55c-3 23-20 33-53 33s-50-10-53-33l-8-55Z" fill="#e3f1ce" stroke="#42573c" strokeWidth="3.5" />
    <path d="M61 118c34 8 84 8 118 0" fill="none" stroke="#c7dcad" strokeWidth="4" strokeLinecap="round" />
    <path d="M61 140c-15-8-25-3-23 9 2 10 15 15 28 10m108-19c15-8 25-3 23 9-2 10-15 15-28 10" fill="#d3e8bc" stroke="#42573c" strokeWidth="3" strokeLinecap="round" />
    <ellipse cx="92" cy="152" rx="5" ry="7" fill="#34472f" />
    <ellipse cx="148" cy="152" rx="5" ry="7" fill="#34472f" />
    <circle cx="94" cy="150" r="1.7" fill="#fff" /><circle cx="150" cy="150" r="1.7" fill="#fff" />
    <ellipse cx="79" cy="165" rx="9" ry="5" fill="#f1c7b6" opacity=".8" />
    <ellipse cx="161" cy="165" rx="9" ry="5" fill="#f1c7b6" opacity=".8" />
    <path d="M108 165c6 8 18 8 24 0" fill="none" stroke="#42573c" strokeWidth="3" strokeLinecap="round" />
    {equipped === 'leaf' ? <g><path d="M76 99c-14 2-23-8-22-18 14-1 24 6 22 18Z" fill="#8ab85e" stroke="#42573c" strokeWidth="2.5" /><path d="m62 88 13 11" stroke="#42573c" strokeWidth="2" /></g> : null}
    {equipped === 'cap' ? <g fill="#a9cbd8" stroke="#42573c" strokeWidth="3"><path d="M69 101c2-24 17-35 39-30 19 4 26 16 24 31Z" /><path d="M72 101c-13-5-25-3-29 4 11 7 27 8 43 1" strokeLinejoin="round" /><path d="m100 75-5 23" fill="none" /></g> : null}
    {equipped === 'star' ? <path d="m144 178 4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1Z" fill="#f4d473" stroke="#8d7335" strokeWidth="2" strokeLinejoin="round" /> : null}
    {equipped === 'scarf' ? <g fill="#d9b49c" stroke="#7c5c48" strokeWidth="2.5"><path d="M66 115c25 9 83 10 108 0l-2 14c-27 10-77 10-104 0Z" /><path d="m151 132 18-3 6 32-15 7Z" /></g> : null}
    {equipped === 'flower' ? <g transform="translate(166 91)"><path d="M0-7c-12-19-25-2-13 8-13 13 2 26 12 13 15 14 28-2 14-13 12-14-5-27-13-8Z" fill="#efc1b4" stroke="#b88471" strokeWidth="2.5" /><circle r="7" cy="3" fill="#f4d473" stroke="#b88471" strokeWidth="2" /></g> : null}
    {equipped === 'crown' ? <g fill="#f4d473" stroke="#8d7335" strokeWidth="2.5" strokeLinejoin="round"><path d="m98 43-5-23 16 10 12-18 12 18 16-10-5 23Z" /><path d="M98 43h46v8H98Z" /></g> : null}
  </svg>;
}
