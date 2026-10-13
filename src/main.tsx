import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadCatalog } from './lib/catalog';
import { readLanguage, translations } from './lib/i18n';
import './styles.css';
const root=createRoot(document.getElementById('root')!);
const initialLanguage=readLanguage();
const initialCopy=translations[initialLanguage];
document.documentElement.lang=initialLanguage;
document.documentElement.dir=initialLanguage==='he'?'rtl':'ltr';
async function start(){
  root.render(<main className="loading-page"><h1>{initialCopy.appName}</h1><p role="status">{initialCopy.loading}</p></main>);
  try{await loadCatalog();root.render(<React.StrictMode><App/></React.StrictMode>);}
  catch{root.render(<main className="loading-page"><h1>{initialCopy.offlineTitle}</h1><p>{initialCopy.offlineBody}</p><button className="primary-button" onClick={start}>{initialCopy.retry}</button><nav><a href="/parents">{initialCopy.parents}</a><a href="/privacy">{initialCopy.privacy}</a><a href="/rules">{initialCopy.productRules}</a></nav></main>);}
}
void start();
