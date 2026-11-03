import {useEffect,useRef,useState} from 'react';
import {CreditCard,RefreshCw} from 'lucide-react';
import type {Language} from '../types';
import type {BillingSnapshot} from '../billing';
import * as api from '../api';
import '../billing.css';

export function Billing({lang,accountId,onSignIn}:{lang:Language;accountId?:string;onSignIn:()=>void}){
 const zh=lang==='zh',mounted=useRef(false),epoch=useRef(0),busyRef=useRef(false),controller=useRef<AbortController|null>(null);
 const [state,setState]=useState<BillingSnapshot|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const message=(cause:unknown)=>{const code=cause instanceof api.ApiError?cause.code:'';return code==='BILLING_ACCOUNT_MISMATCH'||cause instanceof api.ApiError&&cause.status===401?zh?'账户状态已变化，请重新登录后查看。':'Your account changed. Sign in again.':code==='BILLING_IN_PROGRESS'?zh?'正在处理上一次请求，请稍后刷新。':'Another request is in progress. Refresh shortly.':zh?'会员服务暂不可用，请稍后刷新；已有记录和手动填写不受影响。':'Membership is temporarily unavailable. Refresh later; your records and manual logging remain available.';};
 async function run(task:(signal:AbortSignal)=>Promise<BillingSnapshot>,action=false){
  if(action&&busyRef.current)return;
  if(action){busyRef.current=true;setBusy(true);}else setLoading(true);
  const seq=++epoch.current;controller.current?.abort();const active=new AbortController();controller.current=active;setError('');
  try{const next=await task(active.signal);if(mounted.current&&seq===epoch.current&&!active.signal.aborted)setState(next);}
  catch(cause){if(mounted.current&&seq===epoch.current&&!active.signal.aborted)setError(message(cause));}
  finally{if(mounted.current&&seq===epoch.current){busyRef.current=false;setBusy(false);setLoading(false);}}
 }
 const load=()=>run(signal=>accountId?api.getBillingAccount(accountId,signal):api.getBillingOptions(signal));
 useEffect(()=>{mounted.current=true;void load();return()=>{mounted.current=false;epoch.current++;controller.current?.abort();};},[accountId]);
 const format=(cents:number,currency:string)=>new Intl.NumberFormat(zh?'zh-CN':'en-US',{style:'currency',currency}).format(cents/100);
 const date=(value:string)=>new Date(value).toLocaleDateString(zh?'zh-CN':'en-US',{timeZone:'UTC'});
 const select=(code:string)=>{if(!accountId){onSignIn();return;}void run(signal=>api.selectBillingPlan(accountId,code,signal),true);};
 return <section className="panel stack billing-panel" aria-busy={busy||loading}>
  <div className="section-heading"><h2><CreditCard size={21} aria-hidden="true"/> {zh?'会员与账单':'Membership and billing'}</h2><button className="btn btn-ghost" type="button" disabled={busy||loading} onClick={()=>void load()}><RefreshCw size={16} aria-hidden="true"/>{zh?'刷新':'Refresh'}</button></div>
  <div className="billing-test-notice" role="note"><strong>{zh?'本地测试 · 不会扣真实款':'Local testing · No real charges'}</strong><p>{zh?'以下套餐价格和次数仅用于验证流程，正式销售价格与额度尚未发布。':'Prices and allowances below are test templates. Production pricing and allowances have not been published.'}</p></div>
  {error&&<p className="form-error" role="alert">{error}</p>}
  {loading&&!state?<p role="status">{zh?'正在读取套餐与额度…':'Loading plans and allowance…'}</p>:null}
  {state&&!state.available?<p className="hint">{zh?'会员功能尚未启用，现有登录与记录仍可正常使用。':'Membership is not enabled. Existing sign-in and records remain available.'}</p>:null}
  {!!state?.available&&<>
   <div className="billing-plans">{state.plans.map(plan=>{const selected=state.subscription?.planCode===plan.code,pro=plan.code==='pro_test';return <article className="billing-plan" key={plan.code}>
    <div className="row-actions"><h3>{pro?'Pro':zh?'免费版':'Free'}</h3><span className="badge">{zh?'测试套餐':'Test plan'}</span></div>
    <strong className="billing-price">{format(plan.amountCents,plan.currency)}<small> / {zh?'月':'month'}</small></strong>
    <p>{zh?`每周期 ${plan.monthlyPhotoLimit} 次成功食物识别`:`${plan.monthlyPhotoLimit} successful food analyses per period`}</p>
    <p className="muted">{zh?'识别失败或照片不是食物不扣次数；修改食物、份量和保存不重复扣次数。':'Failed analyses and non-food photos do not use your allowance. Editing food, portions and saving do not count again.'}</p>
    <button type="button" className={`btn ${pro?'btn-primary':'btn-secondary'} full-width`} disabled={busy||loading||selected} onClick={()=>select(plan.code)}>{!accountId?zh?'登录后选择':'Sign in to choose':selected?zh?'当前测试套餐':'Current test plan':pro?zh?'选择 Pro 测试套餐':'Choose Pro test plan':zh?'下周期转为免费版':'Switch to Free next period'}</button>
   </article>;})}</div>
   {accountId&&state.subscription&&<div className="billing-usage stack">
    <strong>{state.subscription.effectivePlanCode==='pro_test'?zh?'Pro 测试权益已启用':'Pro test access is active':zh?'当前使用免费额度':'Using the Free allowance'}</strong>
    {state.subscription.planCode==='pro_test'&&!state.subscription.paid?<p role="status">{zh?'测试账单尚未结算。完成下方模拟付款后才启用 Pro 额度。':'The test invoice is unsettled. Use simulated payment below to activate the Pro allowance.'}</p>:null}
    <p>{zh?`本周期已用 ${state.usage.used} / ${state.usage.limit} 次，剩余 ${state.usage.remaining} 次。`:`Used ${state.usage.used} of ${state.usage.limit}; ${state.usage.remaining} remaining this period.`}</p>
    {state.usage.reserved>0?<p className="muted">{zh?`${state.usage.reserved} 次正在识别中`:`${state.usage.reserved} analyses in progress`}</p>:null}
    {state.usage.pendingEvents>0?<p className="muted">{zh?'用量同步中，已用次数已保存。':'Usage is syncing; consumed units are already saved.'}</p>:null}
    <p className="muted">{zh?'周期截至 ':'Period ends '}{date(state.subscription.periodEnd)}{zh?'（账单时区 UTC）':' (billing timezone UTC)'}</p>
    {state.subscription.cancelAtPeriodEnd?<p role="status">{zh?'已取消下期续费；当前周期的测试权益保留，到期转为免费版。':'Renewal is canceled. Current-period test access remains, then switches to Free.'}</p>:state.subscription.planCode==='pro_test'?<button className="btn btn-ghost" type="button" disabled={busy||loading} onClick={()=>void run(signal=>api.cancelBillingRenewal(accountId,signal),true)}>{zh?'取消下期续费':'Cancel next renewal'}</button>:null}
   </div>}
   {accountId&&<div className="stack"><h3>{zh?'测试账单':'Test invoices'}</h3>{state.invoices.length===0?<p className="muted">{zh?'账单正在生成或尚无账单，稍后可刷新。':'Invoices may still be generating. Refresh shortly.'}</p>:<div className="billing-table-wrap"><table><thead><tr><th>{zh?'账单':'Invoice'}</th><th>{zh?'测试金额':'Test amount'}</th><th>{zh?'状态':'Status'}</th><th>{zh?'操作':'Action'}</th></tr></thead><tbody>{state.invoices.map(invoice=><tr key={invoice.id}><td>{invoice.number}<small>{date(invoice.createdAt)}</small></td><td>{format(invoice.amountCents,invoice.currency)}</td><td>{invoice.paymentStatus==='succeeded'?zh?'测试已结算':'Test settled':invoice.status==='draft'?zh?'生成中':'Draft':zh?'待测试结算':'Test pending'}</td><td>{invoice.status==='finalized'&&invoice.paymentStatus!=='succeeded'&&invoice.amountCents>0?<button className="btn btn-secondary" type="button" disabled={busy||loading} onClick={()=>void run(signal=>api.simulateBillingPayment(accountId,invoice.id,signal),true)}>{zh?'模拟付款（不会扣款）':'Simulate payment (no charge)'}</button>:<span className="muted">—</span>}</td></tr>)}</tbody></table></div>}</div>}
  </>}
 </section>;
}
