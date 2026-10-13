import {randomUUID} from 'node:crypto';
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import {createUnlockCode,PRODUCT,verifyUnlockCode} from './unlock-code.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createApp({config,store,stripe,staticDir='dist'}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({crossOriginEmbedderPolicy:false}));
  app.use(compression());

  app.post('/api/stripe/webhook',express.raw({type:'application/json',limit:'256kb'}),async(req,res)=>{
    if (!config.stripeConfigured || !stripe) return res.status(503).json({ok:false,error:'stripe_not_configured'});
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body,req.get('stripe-signature'),config.stripeWebhookSecret);
    } catch {
      return res.status(400).json({ok:false,error:'invalid_signature'});
    }
    try {
      if (event.livemode) return res.status(400).json({ok:false,error:'live_mode_disabled'});
      const session = event.data?.object;
      if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
        if (session?.mode !== 'payment' || session?.payment_status !== 'paid' || session?.metadata?.sku !== PRODUCT) {
          return res.json({received:true});
        }
        const purchaseId = session.metadata.purchase_id;
        const unlockCode = session.metadata.unlock_code;
        if (verifyUnlockCode(unlockCode,config.unlockSigningSecret) !== purchaseId) {
          return res.status(400).json({ok:false,error:'invalid_unlock_metadata'});
        }
        const email = typeof session.customer_details?.email === 'string' ? session.customer_details.email.slice(0,320) : null;
        const updated = await store.markPaid({id:purchaseId,email,unlockCode,providerRef:session.id});
        if (!updated) throw new Error('purchase_provider_mismatch');
      } else if (event.type === 'checkout.session.async_payment_failed' && session?.id) {
        await store.markFailed(session.id);
      }
      return res.json({received:true});
    } catch {
      return res.status(500).json({ok:false,error:'webhook_processing_failed'});
    }
  });

  app.use(express.json({limit:'16kb'}));

  app.get('/api/health',(_req,res)=>res.json({ok:true,service:'matchstick-arithmetic',stripe:config.stripeConfigured?'test':'not_configured'}));

  const checkoutAttempts = new Map();
  app.post('/api/checkout/session',async(req,res)=>{
    if (req.get('origin') !== config.baseUrl) return res.status(403).json({ok:false,error:'origin_not_allowed'});
    if (!config.stripeConfigured || !stripe) return res.status(503).json({ok:false,error:'stripe_not_configured'});
    const now=Date.now(),ip=req.ip||'unknown',attempt=checkoutAttempts.get(ip);
    if (attempt&&attempt.until>now&&attempt.count>=10) return res.status(429).json({ok:false,error:'rate_limited'});
    checkoutAttempts.set(ip,attempt&&attempt.until>now?{count:attempt.count+1,until:attempt.until}:{count:1,until:now+600_000});
    const email = req.body?.email;
    if (email != null && (typeof email !== 'string' || email.length>320 || !emailPattern.test(email))) {
      return res.status(400).json({ok:false,error:'invalid_email'});
    }
    const purchaseId=randomUUID();
    const unlockCode=createUnlockCode(purchaseId,config.unlockSigningSecret);
    try {
      const session=await stripe.checkout.sessions.create({
        mode:'payment',
        customer_email:email||undefined,
        line_items:[{quantity:1,price_data:{
          currency:config.currency,
          unit_amount:config.priceMinor,
          product_data:{name:'Спички: полная версия',metadata:{sku:PRODUCT}},
        }}],
        metadata:{sku:PRODUCT,purchase_id:purchaseId,unlock_code:unlockCode},
        success_url:`${config.baseUrl}/success?unlock=${encodeURIComponent(unlockCode)}`,
        cancel_url:`${config.baseUrl}/cancel`,
      },{idempotencyKey:purchaseId});
      await store.createPending({id:purchaseId,email:email||null,providerRef:session.id});
      return res.status(201).json({url:session.url});
    } catch {
      return res.status(502).json({ok:false,error:'checkout_session_failed'});
    }
  });

  app.get('/api/unlock/:code',async(req,res)=>{
    const purchaseId=verifyUnlockCode(req.params.code,config.unlockSigningSecret);
    if (!purchaseId) return res.status(404).json({ok:false});
    try {
      const purchase=await store.findPaidByUnlockCode(req.params.code);
      return purchase?res.json({ok:true,product:PRODUCT}):res.status(404).json({ok:false});
    } catch { return res.status(503).json({ok:false}); }
  });

  app.use('/api',(_req,res)=>res.status(404).json({ok:false,error:'not_found'}));
  app.use(express.static(staticDir,{index:'index.html',setHeaders(res,path){
    if (path.endsWith('puzzles.json')) res.setHeader('Cache-Control','no-store');
    else if (path.endsWith('sw.js')) res.setHeader('Cache-Control','no-cache');
    else if (path.includes('/assets/')) res.setHeader('Cache-Control','public,max-age=31536000,immutable');
  }}));
  app.get('/{*path}',(_req,res)=>res.sendFile('index.html',{root:staticDir}));
  return app;
}
