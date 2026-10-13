// No analytics or network calls beyond the same-origin service worker.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', {updateViaCache:'none'}).catch(() => {
      // Online play remains available if the browser disallows offline storage.
    });
  });
}
let installPrompt;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();installPrompt=event;
  document.querySelectorAll('[data-install-app]').forEach(button=>{button.hidden=false;});
});
document.addEventListener('click', async event => {
  const button=event.target.closest?.('[data-install-app]');
  if(!button||!installPrompt)return;
  await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;
  document.querySelectorAll('[data-install-app]').forEach(button=>{button.hidden=true;});
});
window.addEventListener('appinstalled',()=>{installPrompt=null;document.querySelectorAll('[data-install-app]').forEach(button=>{button.hidden=true;});});
// React may render the install help after the browser first offers installation.
document.addEventListener('toggle',event=>{
  if(event.target.matches?.('.install-help')&&installPrompt)event.target.querySelectorAll('[data-install-app]').forEach(button=>{button.hidden=false;});
},true);
