import { useEffect, useRef, useState } from 'react';
import { puzzles } from './lib/catalog';
import { canPlay } from './data/access';
import { Board, initialMatches, Preview, type Match } from './components/Board';
import { Icon, Logo } from './components/Icon';
import { Modal } from './components/Modal';
import { applyMove, checkBoard, decode, initialBoard, solutionMoves, type BoardState, type Difficulty, type Move, type Puzzle, type PuzzlePack } from './lib/engine';
import { readLanguage, translations, type Copy, type Language } from './lib/i18n';
import { hasParentPin, isParentPin, saveParentPin, verifyParentPin } from './lib/parent-pin';
import { PROGRESS_KEY, readProgress, saveProgress, type Progress } from './lib/storage';

type Message = 'correct'|'incorrect'|'invalid'|'noMoves'|'hintOne'|'hintTwo'|'hintReset'|'revealed'|'clear'|'solutionUnavailable';
type PaymentMessage = 'unlockChecking'|'unlockSuccess'|'unlockFailed'|'checkoutCancelled';
type ModalName = 'rules'|'progress'|'pinSetup'|'pinVerify'|'parentChoice'|'parentSettings'|'restore'|null;
type PinError = 'pinFormat'|'pinMismatch'|'pinIncorrect'|'pinStorageError'|null;
type RestoreError = 'restoreInvalid'|'restoreUnavailable'|null;
type ParentIntent = 'unlock'|'settings';
const readPuzzle = () => puzzles.find(p=>`#/puzzle/${p.id}`===window.location.hash)??null;
const number = (p:Puzzle) => String(puzzles.indexOf(p)+1).padStart(2,'0');
const PACKS: PuzzlePack[] = ['start','signs','champion'];
function DifficultyBadge({difficulty,t}:{difficulty:Difficulty;t:Copy}) {return <span className={`difficulty ${difficulty}`}><span className="difficulty-dots" aria-hidden="true">{[0,1,2].map(i=><i key={i} className={i<({easy:1,medium:2,hard:3}[difficulty])?'lit':''}/>)}</span>{t[difficulty]}</span>;}

export function App() {
  const [language,setLanguage]=useState<Language>(readLanguage);
  const [progress,setProgress]=useState<Progress>(readProgress);
  const [puzzle,setPuzzle]=useState<Puzzle|null>(readPuzzle);
  const [filter,setFilter]=useState<Difficulty|'all'>('all');
  const [modal,setModal]=useState<ModalName>(null);
  const [storageError,setStorageError]=useState(false);
  const [checkoutBusy,setCheckoutBusy]=useState(false);
  const [checkoutError,setCheckoutError]=useState(false);
  const [paymentMessage,setPaymentMessage]=useState<PaymentMessage|null>(null);
  const [parentIntent,setParentIntent]=useState<ParentIntent>('unlock');
  const [pin,setPin]=useState('');
  const [pinConfirm,setPinConfirm]=useState('');
  const [pinBusy,setPinBusy]=useState(false);
  const [pinError,setPinError]=useState<PinError>(null);
  const [restoreCode,setRestoreCode]=useState('');
  const [restoreBusy,setRestoreBusy]=useState(false);
  const [restoreError,setRestoreError]=useState<RestoreError>(null);
  const t=translations[language];
  const returnPage=window.location.pathname.replace(/\/$/,'') as ''|'/success'|'/cancel';
  const paymentPage=returnPage==='/success'||returnPage==='/cancel';
  useEffect(()=>{document.documentElement.lang=language;document.documentElement.dir=language==='he'?'rtl':'ltr';document.title=`${returnPage==='/success'?t.paymentSuccessTitle:returnPage==='/cancel'?t.paymentCancelTitle:t.appName}${paymentPage?` — ${t.appName}`:''}`;try{localStorage.setItem('matchstick-language',language);}catch{/* Keep the selected language for this session. */}},[language,t,paymentPage,returnPage]);
  useEffect(()=>{setStorageError(!saveProgress(progress));},[progress]);
  useEffect(()=>{
    const url=new URL(window.location.href),code=url.searchParams.get('unlock'),cancelled=returnPage==='/cancel'||url.searchParams.get('checkout')==='cancelled';
    const clean=()=>{url.searchParams.delete('unlock');url.searchParams.delete('checkout');window.history.replaceState(null,'',`${url.pathname}${url.search}${url.hash}`);};
    if(!code){if(cancelled){setPaymentMessage('checkoutCancelled');clean();}else if(returnPage==='/success')setPaymentMessage('unlockFailed');return;}
    let active=true;setPaymentMessage('unlockChecking');
    void (async()=>{
      for(let attempt=0;attempt<6&&active;attempt++){
        try{
          const response=await fetch(`/api/unlock/${encodeURIComponent(code)}`,{cache:'no-store'});
          const result=await response.json();
          if(response.ok&&result.ok===true&&result.product==='full_version'){
            setProgress(previous=>({...previous,unlocked:true,unlockCode:code}));setPaymentMessage('unlockSuccess');clean();return;
          }
          if(response.status!==404)break;
        }catch{/* A short retry also covers a webhook arriving just after the redirect. */}
        await new Promise(resolve=>setTimeout(resolve,1500));
      }
      if(active){setPaymentMessage('unlockFailed');clean();}
    })();
    return()=>{active=false;};
  },[returnPage]);
  useEffect(()=>{const changed=()=>{setPuzzle(readPuzzle());setModal(null);window.scrollTo({top:0,behavior:'instant'});};window.addEventListener('hashchange',changed);const stored=(e:StorageEvent)=>{if(e.key===PROGRESS_KEY||e.key===null)setProgress(readProgress());};window.addEventListener('storage',stored);return ()=>{window.removeEventListener('hashchange',changed);window.removeEventListener('storage',stored);};},[]);
  const open=(p:Puzzle)=>{window.location.hash=`/puzzle/${p.id}`;};
  const home=()=>{if(paymentPage)window.location.assign('/#/');else window.location.hash='/';};
  const addProgress=(kind:'solvedIds'|'hintedIds',id:string)=>setProgress(previous=>previous[kind].includes(id)?previous:{...previous,[kind]:[...previous[kind],id]});
  const clearParentForm=()=>{setPin('');setPinConfirm('');setPinError(null);setCheckoutError(false);};
  const openParentGate=(intent:ParentIntent)=>{clearParentForm();setParentIntent(intent);setModal(hasParentPin()?'pinVerify':'pinSetup');};
  const parentDestination=()=>setModal(parentIntent==='unlock'?'parentChoice':'parentSettings');
  const submitPinSetup=async()=>{
    if(!isParentPin(pin)){setPinError('pinFormat');return;}
    if(pin!==pinConfirm){setPinError('pinMismatch');return;}
    setPinBusy(true);const saved=await saveParentPin(pin);setPinBusy(false);
    if(!saved){setPinError('pinStorageError');return;}clearParentForm();parentDestination();
  };
  const submitPinVerify=async()=>{
    if(!isParentPin(pin)){setPinError('pinFormat');return;}
    setPinBusy(true);const valid=await verifyParentPin(pin);setPinBusy(false);
    if(!valid){setPinError('pinIncorrect');return;}clearParentForm();parentDestination();
  };
  const startCheckout=async()=>{
    setCheckoutBusy(true);setCheckoutError(false);
    try{
      const response=await fetch('/api/checkout/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
      const result=await response.json();
      if(!response.ok||typeof result.url!=='string')throw Error();
      const target=new URL(result.url,window.location.href);
      if(target.origin!==window.location.origin&&target.hostname!=='checkout.stripe.com')throw Error();
      window.location.assign(target.href);
    }catch{setCheckoutBusy(false);setCheckoutError(true);}
  };
  const openRestore=()=>{setRestoreCode('');setRestoreError(null);setModal('restore');};
  const restoreAccess=async()=>{
    const code=restoreCode.trim();if(!code||code.length>512){setRestoreError('restoreInvalid');return;}
    setRestoreBusy(true);setRestoreError(null);
    try{
      const response=await fetch(`/api/unlock/${encodeURIComponent(code)}`,{cache:'no-store'}),result=await response.json();
      if(!response.ok||result.ok!==true||result.product!=='full_version'){setRestoreError('restoreInvalid');return;}
      setProgress(previous=>({...previous,unlocked:true,unlockCode:code}));setPaymentMessage('unlockSuccess');setModal(null);
    }catch{setRestoreError('restoreUnavailable');}finally{setRestoreBusy(false);}
  };
  const visible=puzzles.filter(p=>filter==='all'||p.difficulty===filter);
  const packLabels:Record<PuzzlePack,string>={start:t.packStart,signs:t.packSigns,champion:t.packChampion};
  const first=puzzles.find(p=>canPlay(p.id,progress.unlocked)&&!progress.solvedIds.includes(p.id))??puzzles[0];
  const locked=!!puzzle&&!canPlay(puzzle.id,progress.unlocked);
  return <div className={`app-shell ${puzzle?'is-playing':''}`}>
    <header className="site-header"><div className="header-inner">
      <a className="brand" href="#/" aria-label={t.appName}><Logo/><span><strong>{t.brand}</strong><small>{t.brandSub}</small></span></a>
      <nav aria-label={t.catalog} className="main-nav"><a href="#/" className={!puzzle?'active':''}>{t.catalog}</a><button onClick={()=>setModal('rules')}>{t.rules}</button></nav>
      <div className="header-tools"><button className="icon-button mobile-rules" onClick={()=>setModal('rules')} aria-label={t.rules}><Icon name="book"/></button><button className="icon-button parent-settings-button" onClick={()=>openParentGate('settings')} aria-label={t.parentSettings} title={t.parentSettings}><Icon name="lock" size={18}/></button><label className="language-picker"><Icon name="globe" size={17}/><select aria-label={t.language} value={language} onChange={e=>setLanguage(e.target.value as Language)}><option value="ru">Русский</option><option value="he">עברית</option></select><svg aria-hidden="true" width="10" height="7" viewBox="0 0 10 7"><path d="m1 1 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg></label></div>
    </div></header>
    {storageError&&<p className="storage-warning" role="status">{t.storageError}</p>}
    {paymentMessage&&!paymentPage&&<p className={`payment-status ${paymentMessage==='unlockSuccess'?'success':''}`} role="status">{t[paymentMessage]}</p>}
    {paymentPage?<PaymentReturn page={returnPage as '/success'|'/cancel'} message={paymentMessage} t={t} onBack={home}/>:puzzle?locked?<main className="play-main gate-main"><div className="play-breadcrumb"><button className="text-button" onClick={home}><Icon name="back" className="directional"/>{t.back}</button><span>{t.puzzle} {number(puzzle)}</span></div><section className="access-gate"><div className="gate-lock"><Icon name="lock" size={30}/></div><h1>{t.lockedTitle}</h1><div className="play-badges"><DifficultyBadge difficulty={puzzle.difficulty} t={t}/><span className="puzzle-title" dir="ltr">{puzzle.title}</span></div><Preview puzzle={puzzle}/><button className="primary-button" onClick={()=>openParentGate('unlock')}><Icon name="lock"/>{t.unlock}</button></section></main>:<Play key={puzzle.id} puzzle={puzzle} t={t} onBack={home} onNext={()=>open(puzzles[(puzzles.indexOf(puzzle)+1)%puzzles.length])} onSolved={()=>addProgress('solvedIds',puzzle.id)} onHint={()=>addProgress('hintedIds',puzzle.id)}/>:<main className="catalog-main">
      <section className="hero">
        <div className="hero-copy"><p className="eyebrow"><span className="tiny-spark">✦</span>{t.eyebrow}</p><h1>{t.heroStart}<br/><em>{t.heroEnd}</em></h1><p className="hero-subtitle">{t.subtitle}</p><button className="primary-button" onClick={()=>open(first)}>{progress.solvedIds.length?t.resume:t.start}<Icon className="directional" name="arrow"/></button><p className="hero-note"><span/>{t.heroNote}</p></div>
        <button className="featured-board" onClick={()=>open(puzzles[0])} aria-label={`${t.tryIt}: ${puzzles[0].title}`}><div className="featured-top"><span>{t.featured}</span><span className="featured-number">01 / {puzzles.length}</span></div><Preview puzzle={puzzles[0]}/><span className="featured-prompt">{t.featuredPrompt}</span><span className="featured-link">{t.tryIt}<Icon name="arrow" size={17} className="directional"/></span><span className="featured-corner" aria-hidden="true">✧</span></button>
      </section>
      <section className="collection-section" aria-labelledby="collection-title">
        <div className="collection-header"><div><p className="eyebrow collection-eyebrow">01 — {puzzles.length}</p><h2 id="collection-title">{t.collection}</h2><p>{t.collectionSub}</p></div><div className="progress-widget"><div className="progress-ring"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20"/><circle className="ring-value" cx="24" cy="24" r="20" strokeDasharray={`${progress.solvedIds.length/puzzles.length*125.66} 125.66`}/></svg><Icon name={progress.solvedIds.length===puzzles.length?'check':'spark'} size={19}/></div><div><span>{t.progress}</span><strong className="solved-count"><span>{t.solvedBadge}</span> <bdi dir="ltr"><b>{progress.solvedIds.length}</b> / {puzzles.length}</bdi></strong></div></div></div>
        {progress.solvedIds.length===puzzles.length&&<p className="collection-complete"><Icon name="check"/>{t.allComplete}</p>}
        <div className="filter-row"><div className="filters" role="group" aria-label={t.catalog}>{(['all','easy','medium','hard'] as const).map(f=><button key={f} aria-pressed={filter===f} className={filter===f?'selected':''} onClick={()=>setFilter(f)}>{t[f]}<span>{f==='all'?puzzles.length:puzzles.filter(p=>p.difficulty===f).length}</span></button>)}</div><span className="catalog-count">{visible.length} {t.puzzles}</span></div>
        {visible.length?<div className="pack-list">{PACKS.map(pack=>{const entries=visible.filter(p=>p.pack===pack);if(!entries.length)return null;return <section className="puzzle-pack" data-pack={pack} key={pack} aria-labelledby={`pack-${pack}`}><header className="pack-header"><h3 id={`pack-${pack}`}>{packLabels[pack]}</h3><span>{entries.length} {t.puzzles}</span></header><div className="puzzle-grid">{entries.map(p=>{const solved=progress.solvedIds.includes(p.id),cardLocked=!canPlay(p.id,progress.unlocked);return <button key={p.id} className={`puzzle-card ${solved?'is-solved':''} ${cardLocked?'is-locked':''}`} data-puzzle-id={p.id} onClick={()=>open(p)} aria-label={`${t.puzzle} ${number(p)}: ${p.title}, ${t[p.difficulty]}, ${p.movesAllowed===1?t.oneMove:t.twoMoves}, ${solved?t.solvedBadge:t.notSolved}${cardLocked?`, ${t.lockedTitle}`:''}`}><div className="card-top"><span className="card-number">{number(p)}</span><span className="card-status">{cardLocked&&<span className="locked-tag" aria-label={t.lockedTitle}><Icon name="lock" size={16}/></span>}{solved?<span className="solved-tag"><Icon name="check" size={13}/>{t.solvedBadge}</span>:!cardLocked?<span className="card-open"><Icon name="arrow" size={16} className="directional"/></span>:null}</span></div><Preview puzzle={p}/><div className="card-bottom"><DifficultyBadge difficulty={p.difficulty} t={t}/><span className="card-moves">{progress.hintedIds.includes(p.id)&&<span title={t.hinted}><Icon name="bulb" size={13}/></span>}{p.movesAllowed===1?t.oneMove:t.twoMoves}</span></div></button>;})}</div></section>;})}</div>:<p className="catalog-empty" role="status">{t.catalogEmpty}</p>}
      </section>
      <footer className="catalog-footer"><p><Icon name="spark" size={16}/>{t.footer}</p><div><span><Icon name="lock" size={13}/>{t.saved}</span><button onClick={()=>openParentGate('settings')}>{t.parentSettings}</button><button onClick={()=>setModal('progress')} disabled={!progress.solvedIds.length&&!progress.hintedIds.length}>{t.resetProgress}</button></div></footer>
    </main>}
    <footer className="product-footer"><nav aria-label={t.productNav}><a href="/parents">{t.parents}</a><a href="/privacy">{t.privacy}</a><a href="/rules">{t.productRules}</a></nav><details className="install-help"><summary>{t.installTitle}</summary><p>{t.installHelp}</p><button className="secondary-button" data-install-app hidden>{t.installApp}</button></details></footer>
    {modal==='rules' &&<Modal title={t.rulesTitle} closeLabel={t.close} onClose={()=>setModal(null)}><p className="modal-intro">{t.rulesIntro}</p><ol className="rules-list">{[t.rule1,t.rule2,t.rule3,t.rule4,t.rule5].map((r,i)=><li key={i}><span>{String(i+1).padStart(2,'0')}</span>{r}</li>)}</ol><button className="primary-button full-width" onClick={()=>setModal(null)}>{t.gotIt}<Icon name="arrow" className="directional"/></button></Modal>}
    {modal==='pinSetup'&&<Modal title={t.setParentPin} closeLabel={t.close} onClose={()=>setModal(null)}><p className="modal-intro">{t.setupPinIntro}</p><PinFields t={t} pin={pin} confirm={pinConfirm} onPin={value=>{setPin(value);setPinError(null);}} onConfirm={value=>{setPinConfirm(value);setPinError(null);}} error={pinError?t[pinError]:null}/><div className="modal-actions"><button className="secondary-button" onClick={()=>setModal(null)} disabled={pinBusy}>{t.cancel}</button><button className="primary-button" onClick={submitPinSetup} disabled={pinBusy}>{t.savePin}</button></div></Modal>}
    {modal==='pinVerify'&&<Modal title={t.enterParentPin} closeLabel={t.close} onClose={()=>setModal(null)}><p className="modal-intro">{t.pinGateIntro}</p><PinFields t={t} pin={pin} onPin={value=>{setPin(value);setPinError(null);}} error={pinError?t[pinError]:null}/><div className="modal-actions"><button className="secondary-button" onClick={()=>setModal(null)} disabled={pinBusy}>{t.cancel}</button><button className="primary-button" onClick={submitPinVerify} disabled={pinBusy}>{t.verifyPin}</button></div></Modal>}
    {modal==='parentChoice'&&<Modal title={t.purchaseOptions} closeLabel={t.close} onClose={()=>setModal(null)}><p className="modal-intro">{t.fullVersionOffer}</p><p className="test-mode-note">{t.unlockNotice}</p>{checkoutError&&<p className="checkout-error" role="alert">{t.checkoutUnavailable}</p>}<div className="modal-actions purchase-actions"><button className="secondary-button" onClick={openRestore} disabled={checkoutBusy}>{t.haveCode}</button><button className="primary-button" onClick={startCheckout} disabled={checkoutBusy}>{checkoutBusy?t.checkoutStarting:t.buyOnce}</button></div></Modal>}
    {modal==='restore'&&<Modal title={t.restoreTitle} closeLabel={t.close} onClose={()=>setModal(null)}><p className="modal-intro">{t.restoreIntro}</p><label className="form-field"><span>{t.restoreLabel}</span><input dir="ltr" value={restoreCode} maxLength={512} autoCapitalize="off" autoCorrect="off" spellCheck={false} onChange={event=>{setRestoreCode(event.target.value);setRestoreError(null);}}/></label>{restoreError&&<p className="form-error" role="alert">{t[restoreError]}</p>}<div className="modal-actions"><button className="secondary-button" onClick={()=>setModal('parentChoice')} disabled={restoreBusy}>{t.cancel}</button><button className="primary-button" onClick={restoreAccess} disabled={restoreBusy}>{restoreBusy?t.restoreChecking:t.restoreAction}</button></div></Modal>}
    {modal==='parentSettings'&&<Modal title={t.parentSettings} closeLabel={t.close} onClose={()=>setModal(null)}><h3 className="settings-title">{t.pinReady}</h3><p className="modal-intro">{t.pinReadyBody}</p><div className="modal-actions"><button className="secondary-button" onClick={openRestore}>{t.haveCode}</button><button className="primary-button" onClick={()=>{clearParentForm();setModal('pinSetup');}}>{t.changePin}</button></div></Modal>}
    {modal==='progress'&&<Modal title={t.resetTitle} closeLabel={t.close} onClose={()=>setModal(null)}><p className="modal-intro">{t.resetBody}</p><div className="modal-actions"><button className="secondary-button" onClick={()=>setModal(null)}>{t.keepProgress}</button><button className="primary-button" onClick={()=>{setProgress(previous=>({...previous,solvedIds:[],hintedIds:[]}));setModal(null);}}>{t.confirmReset}</button></div></Modal>}
  </div>;
}

function PinFields({t,pin,confirm,onPin,onConfirm,error}:{t:Copy;pin:string;confirm?:string;onPin:(value:string)=>void;onConfirm?:(value:string)=>void;error:string|null}) {
  const clean=(value:string)=>value.replace(/\D/g,'').slice(0,4);
  return <div className="pin-fields">
    <label className="form-field"><span>{t.pinLabel}</span><input type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{4}" maxLength={4} dir="ltr" value={pin} onChange={event=>onPin(clean(event.target.value))}/></label>
    {onConfirm&&<label className="form-field"><span>{t.pinConfirmLabel}</span><input type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4}" maxLength={4} dir="ltr" value={confirm} onChange={event=>onConfirm(clean(event.target.value))}/></label>}
    {error&&<p className="form-error" role="alert">{error}</p>}
  </div>;
}

function PaymentReturn({page,message,t,onBack}:{page:'/success'|'/cancel';message:PaymentMessage|null;t:Copy;onBack:()=>void}) {
  const success=page==='/success',complete=message==='unlockSuccess';
  return <main className="payment-return"><section><div className={`payment-return-icon ${complete?'complete':''}`}><Icon name={complete?'check':success?'spark':'back'} size={30}/></div><h1>{success?t.paymentSuccessTitle:t.paymentCancelTitle}</h1><p>{success?(message?t[message]:t.paymentSuccessBody):t.paymentCancelBody}</p><button className="primary-button" onClick={onBack}>{t.backToPuzzles}<Icon name="arrow" className="directional"/></button></section></main>;
}

type Frame = {board:BoardState;matches:Match[]};
function createFrame(p:Puzzle):Frame {const board=initialBoard(p);return {board,matches:initialMatches(board)};}
function moveFrame(frame:Frame,move:Move,puzzle:Puzzle):Frame|null {const board=applyMove(frame.board,move,puzzle.glyphs);if(!board)return null;return {board,matches:frame.matches.map(m=>m.slot.glyph===move.from.glyph&&m.slot.segment===move.from.segment?{...m,slot:move.to}:m)};}
function Play({puzzle,t,onBack,onNext,onSolved,onHint}:{puzzle:Puzzle;t:Copy;onBack:()=>void;onNext:()=>void;onSolved:()=>void;onHint:()=>void}) {
  const [frames,setFrames]=useState<Frame[]>(()=>[createFrame(puzzle)]);
  const [won,setWon]=useState(false);
  const [revealed,setRevealed]=useState(false);
  const [animating,setAnimating]=useState(false);
  const [hintLevel,setHintLevel]=useState(0);
  const [hintMove,setHintMove]=useState<Move|null>(null);
  const [message,setMessage]=useState<Message|null>(null);
  const [revealModal,setRevealModal]=useState(false);
  const [resetKey,setResetKey]=useState(0);
  const timers=useRef<ReturnType<typeof setTimeout>[]>([]);
  const frame=frames[frames.length-1], used=frames.length-1;
  const equation=decode(puzzle.glyphs,frame.board);
  const stopAnimation=()=>{timers.current.forEach(clearTimeout);timers.current=[];setAnimating(false);};
  useEffect(()=>()=>timers.current.forEach(clearTimeout),[]);
  useEffect(()=>{if(!message||['hintOne','hintTwo','hintReset','revealed','invalid','noMoves','solutionUnavailable'].includes(message))return;const timer=setTimeout(()=>setMessage(null),4500);return ()=>clearTimeout(timer);},[message]);
  function reset(){stopAnimation();setFrames([createFrame(puzzle)]);setWon(false);setRevealed(false);setHintMove(null);setHintLevel(0);setMessage(null);setResetKey(k=>k+1);}
  function check(board=frame.board,moves=used){if(animating||revealed)return;const result=checkBoard(puzzle,board,moves);if(result==='solved'){setWon(true);setMessage('correct');onSolved();}else setMessage(moves>=puzzle.movesAllowed?'noMoves':result);}
  function move(move:Move){
    if(won||revealed||animating)return;
    if(used>=puzzle.movesAllowed){setMessage('noMoves');return;}
    const next=moveFrame(frame,move,puzzle);if(!next)return;
    setFrames([...frames,next]);setHintLevel(0);setHintMove(null);setMessage(null);
    const result=checkBoard(puzzle,next.board,used+1);
    if(result==='solved'){setWon(true);setMessage('correct');onSolved();}
    else if(used+1>=puzzle.movesAllowed)setMessage('noMoves');
    else if(result==='invalid')setMessage('invalid');
  }
  function undo(){if(used===0||animating)return;setFrames(frames.slice(0,-1));setWon(false);setRevealed(false);setMessage(null);setHintMove(null);setHintLevel(0);}
  function hint(){
    const path=solutionMoves(puzzle,frame.board,(puzzle.movesAllowed-used) as 1|2);
    if(!path?.length){setMessage(solutionMoves(puzzle)?'hintReset':'solutionUnavailable');return;}
    const level=Math.min(2,hintLevel+1);setHintMove(path[0]);setHintLevel(level);setMessage(level===1?'hintOne':'hintTwo');onHint();
  }
  function reveal(){
    const path=solutionMoves(puzzle);
    if(!path?.length){setRevealModal(false);setMessage('solutionUnavailable');return;}
    setRevealModal(false);reset();onHint();setAnimating(true);setMessage('revealed');
    path.forEach((step,index)=>{timers.current.push(setTimeout(()=>setFrames(history=>{const next=moveFrame(history[history.length-1],step,puzzle);return next?[...history,next]:history;}),450+index*900));});
    timers.current.push(setTimeout(()=>{setAnimating(false);setRevealed(true);},450+path.length*900));
  }
  return <main className="play-main">
    <div className="play-breadcrumb"><button className="text-button" onClick={onBack}><Icon name="back" className="directional" size={18}/>{t.back}</button><span>{t.puzzle} <b dir="ltr">{number(puzzle)} / {puzzles.length}</b></span></div>
    <section className="play-intro">
      <div className="play-summary"><div className="play-badges"><DifficultyBadge difficulty={puzzle.difficulty} t={t}/><span className="subtle-separator"/><span className="puzzle-title" dir="ltr">{puzzle.title}</span></div><div className="move-counter" aria-label={`${t.moves}: ${used} ${t.outOf} ${puzzle.movesAllowed}`}><span>{t.moves}</span><div className="move-dots" aria-hidden="true">{Array.from({length:puzzle.movesAllowed},(_,i)=><i key={i} className={i<used?'used':''}/>)}</div><b dir="ltr">{used} / {puzzle.movesAllowed}</b></div></div>
      <h1>{won?t.correct:revealed?t.revealed:t.boardTitle}</h1><p>{won?t.correctSub:revealed?t.revealedSub:puzzle.movesAllowed===1?t.boardSubtitleOne:t.boardSubtitleTwo}</p>
    </section>
    <section className={`play-table ${won?'table-solved':''}`} aria-label={`${t.puzzle} ${number(puzzle)}: ${puzzle.title}`}>

      <div className="board-stage"><Board puzzle={puzzle} board={frame.board} matches={frame.matches} onMove={move} disabled={won||revealed||animating||used>=puzzle.movesAllowed} hint={hintMove?{from:hintMove.from,...(hintLevel>1?{to:hintMove.to}:{})}:null} copy={t} celebrate={won} resetKey={resetKey} demonstrating={animating}/>{won&&<div className="celebration-sparks" aria-hidden="true">{Array.from({length:12},(_,i)=><i key={i} style={{'--i':i} as React.CSSProperties}>✧</i>)}</div>}</div>
      <div className={`board-message ${message?'has-message':''}`} role="status" aria-live="polite" aria-atomic="true">{message?<span className={message==='correct'?'positive':message.startsWith('hint')?'hint-note':''}><Icon name={message==='correct'?'check':message.startsWith('hint')?'bulb':'spark'} size={17}/>{t[message]}</span>:<span><span className="drag-cursor" aria-hidden="true">↗</span>{t.dragHelp}</span>}</div>
      <div className="table-bottom"><span className="little-match" aria-hidden="true"/><span>{!equation?t.invalid:won?'✓':t.tapHelp}</span><span className="little-match" aria-hidden="true"/></div>
    </section>
    <p className="sr-only" id="board-keyboard-help">{t.keyboardHelp}</p><p className="sr-only" aria-live="polite">{equation?`${t.currentEquation}: ${equation}`:t.invalid}</p>
    <div className="play-actions" role="group" aria-label={t.controls}>
      <div className="utility-actions">
        <button className="secondary-button" onClick={undo} disabled={!used||animating||revealed}><Icon name="undo"/>{t.undo}</button>
        <button className="secondary-button" onClick={reset}><Icon name="reset"/>{t.reset}</button>
        <button className={`secondary-button ${hintLevel?'hint-active':''}`} onClick={hint} disabled={won||revealed||animating}><Icon name="bulb"/><span>{t.hint}{hintLevel>0&&<span className="hint-count"> {hintLevel}/2</span>}</span></button>
      </div>
      <button className="primary-button check-button" onClick={()=>check()} disabled={won||revealed||animating}><Icon name="check"/>{t.check}</button>
      <button className="secondary-button solution-button" onClick={()=>setRevealModal(true)} disabled={won||revealed||animating}><Icon name="eye"/>{t.solution}</button>
    </div>
    {(won||revealed)&&<div className="play-followup">{won?<button className="primary-button" onClick={onNext}>{t.solvedAction}<Icon name="arrow" className="directional"/></button>:<button className="primary-button" onClick={reset}>{t.restart}<Icon name="reset"/></button>}</div>}
    <div className="play-underbar"><span>{t.heroNote}</span></div>
    <div className="puzzle-stepper"><span className="stepper-line"/>{puzzles.map(p=><button key={p.id} className={p.id===puzzle.id?'current':''} onClick={()=>{window.location.hash=`/puzzle/${p.id}`;}} aria-label={`${t.puzzle} ${number(p)}`} aria-current={p.id===puzzle.id?'step':undefined}><span>{number(p)}</span></button>)}<span className="stepper-line"/></div>
    {revealModal&&<Modal title={t.revealTitle} closeLabel={t.close} onClose={()=>setRevealModal(false)}><p className="modal-intro">{t.revealBody}</p><div className="modal-actions"><button className="secondary-button" onClick={()=>setRevealModal(false)}>{t.cancel}</button><button className="primary-button" onClick={reveal}>{t.confirmSolution}<Icon name="eye"/></button></div></Modal>}
  </main>;
}
