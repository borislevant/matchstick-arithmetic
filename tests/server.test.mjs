import {afterEach,test} from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {createApp} from '../server/app.js';
import {readConfig} from '../server/config.js';

const secret='test-unlock-secret-with-more-than-32-characters';
const webhookSecret='whsec_test_webhook_secret';
const stripeTools=new Stripe('sk_test_placeholder_for_local_tests');
const servers=[];
afterEach(async()=>{await Promise.all(servers.splice(0).map(server=>new Promise(resolve=>server.close(resolve))));});

class MemoryStore {
  rows=new Map();
  async createPending(row){this.rows.set(row.id,{...row,status:'pending',unlockCode:null});}
  async markPaid({id,email,unlockCode,providerRef}){
    const row=this.rows.get(id);
    if(row&&row.providerRef!==providerRef)return false;
    this.rows.set(id,{id,email,unlockCode,providerRef,status:'paid'});return true;
  }
  async markFailed(providerRef){for(const row of this.rows.values())if(row.providerRef===providerRef)row.status='failed';}
  async findPaidByUnlockCode(code){return [...this.rows.values()].find(row=>row.status==='paid'&&row.unlockCode===code)||null;}
}

async function serve(app){
  const server=app.listen(0,'127.0.0.1');servers.push(server);
  await new Promise(resolve=>server.once('listening',resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

function config(overrides={}){return {
  baseUrl:'https://staging.example.test',databaseUrl:'postgresql://unused',unlockSigningSecret:secret,
  stripeSecretKey:'sk_test_example',stripeWebhookSecret:webhookSecret,stripeConfigured:true,
  priceMinor:100,currency:'ils',...overrides,
};}

test('configuration refuses live Stripe keys and treats placeholders as unconfigured',()=>{
  assert.throws(()=>readConfig({APP_BASE_URL:'https://example.test',UNLOCK_SIGNING_SECRET:secret,STRIPE_SECRET_KEY:'sk_live_forbidden'}),/Live Stripe keys/);
  const value=readConfig({APP_BASE_URL:'https://example.test',UNLOCK_SIGNING_SECRET:secret,STRIPE_SECRET_KEY:'sk_test_REPLACE_ME',STRIPE_WEBHOOK_SECRET:'whsec_REPLACE_ME'});
  assert.equal(value.stripeConfigured,false);
  assert.equal(value.priceMinor,100);
});

test('checkout creates a one-time full_version session without exposing server keys',async()=>{
  const store=new MemoryStore();let request;
  const stripe={
    checkout:{sessions:{create:async(params,options)=>{request={params,options};return{id:'cs_test_123',url:'https://checkout.stripe.com/c/pay/test'};}}},
    webhooks:stripeTools.webhooks,
  };
  const base=await serve(createApp({config:config(),store,stripe,staticDir:'/tmp/no-static-files'}));
  const response=await fetch(`${base}/api/checkout/session`,{method:'POST',headers:{Origin:'https://staging.example.test','Content-Type':'application/json'},body:'{}'});
  assert.equal(response.status,201);
  assert.deepEqual(await response.json(),{url:'https://checkout.stripe.com/c/pay/test'});
  assert.equal(request.params.mode,'payment');
  assert.equal(request.params.metadata.sku,'full_version');
  assert.equal(request.params.line_items[0].price_data.unit_amount,100);
  assert.match(request.params.success_url,/^https:\/\/staging\.example\.test\/success\?unlock=un_/);
  assert.equal(request.params.cancel_url,'https://staging.example.test/cancel');
  assert.equal(request.options.idempotencyKey,request.params.metadata.purchase_id);
  assert.equal(store.rows.size,1);
  assert.ok(!JSON.stringify(request.params).includes('sk_test_example'));
});

test('a signed paid webhook activates its code and repeated delivery is idempotent',async()=>{
  const store=new MemoryStore();let checkout;
  const stripe={
    checkout:{sessions:{create:async params=>{checkout=params;return{id:'cs_test_paid',url:'https://checkout.stripe.com/c/pay/test'};}}},
    webhooks:stripeTools.webhooks,
  };
  const base=await serve(createApp({config:config(),store,stripe,staticDir:'/tmp/no-static-files'}));
  await fetch(`${base}/api/checkout/session`,{method:'POST',headers:{Origin:'https://staging.example.test','Content-Type':'application/json'},body:'{}'});
  const event={id:'evt_test_paid',object:'event',type:'checkout.session.completed',livemode:false,data:{object:{
    id:'cs_test_paid',mode:'payment',payment_status:'paid',metadata:checkout.metadata,customer_details:{email:'parent@example.test'},
  }}};
  const payload=JSON.stringify(event);
  const signature=stripeTools.webhooks.generateTestHeaderString({payload,secret:webhookSecret});
  for(let delivery=0;delivery<2;delivery++){
    const webhook=await fetch(`${base}/api/stripe/webhook`,{method:'POST',headers:{'Content-Type':'application/json','Stripe-Signature':signature},body:payload});
    assert.equal(webhook.status,200);
    assert.deepEqual(await webhook.json(),{received:true});
  }
  const code=checkout.metadata.unlock_code;
  const unlock=await fetch(`${base}/api/unlock/${encodeURIComponent(code)}`);
  assert.equal(unlock.status,200);
  assert.deepEqual(await unlock.json(),{ok:true,product:'full_version'});
  assert.equal([...store.rows.values()][0].email,'parent@example.test');
});

test('invalid signatures, unpaid codes, foreign origins, and missing Stripe config fail closed',async()=>{
  const store=new MemoryStore();
  const stripe={checkout:{sessions:{create:async()=>({id:'never',url:'https://checkout.stripe.com'})}},webhooks:stripeTools.webhooks};
  const base=await serve(createApp({config:config(),store,stripe,staticDir:'/tmp/no-static-files'}));
  const origin=await fetch(`${base}/api/checkout/session`,{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});
  assert.equal(origin.status,403);
  const webhook=await fetch(`${base}/api/stripe/webhook`,{method:'POST',headers:{'Content-Type':'application/json','Stripe-Signature':'bad'},body:'{}'});
  assert.equal(webhook.status,400);
  const unlock=await fetch(`${base}/api/unlock/un_not-a-code`);assert.equal(unlock.status,404);
  const unconfigured=await serve(createApp({config:config({stripeConfigured:false}),store,stripe:null,staticDir:'/tmp/no-static-files'}));
  const unavailable=await fetch(`${unconfigured}/api/checkout/session`,{method:'POST',headers:{Origin:'https://staging.example.test','Content-Type':'application/json'},body:'{}'});
  assert.equal(unavailable.status,503);
});
