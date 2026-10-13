// Gameplay regression suites exercise an already-unlocked device. The separate
// access browser suite verifies the real confirmation flow and locked routes.
export async function grantTestAccess(page) {
  await page.addInitScript(()=>{
    const key='matchstick-arithmetic-v1';
    const current=JSON.parse(localStorage.getItem(key)||'{}');
    localStorage.setItem(key,JSON.stringify({solvedIds:[],hintedIds:[],...current,unlocked:true}));
  });
}
