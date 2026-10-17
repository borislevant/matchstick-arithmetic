import { Children } from 'react';

export type IconName = 'arrow' | 'back' | 'undo' | 'reset' | 'bulb' | 'check' | 'eye' | 'close' | 'globe' | 'book' | 'spark' | 'lock' | 'chevron';
const paths: Record<IconName, React.ReactNode> = {
  arrow:<><path d="M4 12h15m-6-6 6 6-6 6"/></>,
  back:<path d="M20 12H5m6-6-6 6 6 6"/>,
  undo:<><path d="M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12" transform="translate(0 -2)"/></>,
  reset:<><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/></>,
  bulb:<><path d="M9 18h6m-6 3h6M8 14a6 6 0 1 1 8 0l-1 2H9z"/><path d="M12 1V0M3 4 1 2m20 2 2-2"/></>,
  check:<path d="m5 12 4 4L19 6"/>,
  eye:<><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  close:<path d="m6 6 12 12M6 18 18 6"/>,
  globe:<><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>,
  book:<><path d="M12 5v15M3 4c3-1 6-1 9 1 3-2 6-2 9-1v15c-3-1-6-1-9 1-3-2-6-2-9-1z"/></>,
  spark:<><path d="m12 2 2.6 6.8L21 12l-6.4 2.8L12 22l-2.7-7.2L3 12l6.3-3.2z"/></>,
  lock:<><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></>,
  chevron:<path d="m9 5 7 7-7 7"/>,
};
export function Icon({name,size=20,className=''}:{name:IconName;size?:number;className?:string}) {
  // normalize children to a single group to avoid React attempting unstable insertBefore
  const children = Children.toArray(paths[name]);
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g>{children}</g>
    </svg>
  );
}
export function Logo() { return <svg width="40" height="40" viewBox="0 0 44 44" fill="none" aria-hidden="true"><rect x=".5" y=".5" width="43" height="43" rx="12" fill="#2d2419" stroke="#645036"/><path d="M12 31V12l10 14 10-14v19" stroke="#d9ba84" strokeWidth="3.5" strokeLinecap="round"/><path d="M12 12v3m20-3v3" stroke="#b36540" strokeWidth="5" strokeLinecap="round"/></svg>; }
