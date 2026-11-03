import {Router,type RequestHandler,type Request} from 'express';
import {z} from 'zod';
import {BillingError,PLAN_CODES} from './config';
import type {BillingService} from './service';
function local(req:Request){try{return ['127.0.0.1','localhost','[::1]'].includes(req.hostname)&&['127.0.0.1','localhost','[::1]'].includes(new URL(req.get('Origin')||'about:blank').hostname);}catch{return false;}}
export function billingRouter(service:BillingService,auth:RequestHandler,rateLimit:RequestHandler){
 const router=Router();
 router.get('/options',async(_req,res)=>{const options=service.options();if(options.available)options.plans=await service.plans();res.json(options);});
 router.get('/account',auth,async(_req,res)=>res.json(await service.snapshot(res.locals.account.id)));
 const sandbox:RequestHandler=(req,_res,next)=>{if(!local(req))throw new BillingError('BILLING_LOCAL_TEST_ONLY',403);next();};
 router.post('/subscribe',auth,sandbox,rateLimit,async(req,res)=>{const {planCode}=z.object({planCode:z.enum(PLAN_CODES)}).strict().parse(req.body);res.json(await service.select(res.locals.account.id,planCode));});
 router.post('/simulate-payment',auth,sandbox,rateLimit,async(req,res)=>{const {invoiceId}=z.object({invoiceId:z.string().uuid()}).strict().parse(req.body);res.json(await service.settle(res.locals.account.id,invoiceId));});
 router.post('/cancel-renewal',auth,sandbox,rateLimit,async(req,res)=>{z.object({}).strict().parse(req.body);res.json(await service.cancelRenewal(res.locals.account.id));});
 router.post('/sync',auth,sandbox,rateLimit,async(req,res)=>{z.object({}).strict().parse(req.body);await service.flush(res.locals.account.id);res.json(await service.snapshot(res.locals.account.id));});
 return router;
}
