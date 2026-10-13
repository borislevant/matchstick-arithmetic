import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';
export function Modal({title,closeLabel,onClose,children}:{title:string;closeLabel:string;onClose:()=>void;children:ReactNode}) {
  const ref=useRef<HTMLDialogElement>(null);
  const closeRef=useRef(onClose);closeRef.current=onClose;
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    ref.current?.showModal();
    const before=document.body.style.overflow;document.body.style.overflow='hidden';
    return ()=>{document.body.style.overflow=before;previous?.focus();};
  },[]);
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onCancel={e=>{e.preventDefault();closeRef.current();}} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}>
    <button className="icon-button modal-close" onClick={onClose} aria-label={closeLabel}><Icon name="close"/></button>
    <div className="modal-symbol"><Icon name="spark" size={27}/></div><h2 id="modal-title">{title}</h2>{children}
  </dialog>;
}
