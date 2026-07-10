(()=>{
'use strict';
const $=s=>document.querySelector(s);
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":"&#39;"}[c]));
const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9$#-]+/g,' ').trim();
const words=s=>normalize(s).split(/\s+/).filter(Boolean);
const state=read('yooop-local-agent-state',{pending:null,orderId:null,lastIntent:null});
let chat=read('yooop-ai-chat',[]);
const intents={
 greeting:['hello','hi','hey','good morning','good afternoon'],
 tracking:['track','tracking','where is','where’s','wheres','delivery','package','shipment','arrive','arrival','late','delayed'],
 return:['return','send back','exchange','dont want','do not want','changed my mind'],
 refund:['refund','money back','charged back','credit','reimbursement'],
 damaged:['damaged','broken','cracked','defective','wrong item','missing item','not in box','never came'],
 cancel:['cancel','stop order','dont ship','do not ship'],
 address:['address','ship to','delivery location','wrong address','change location'],
 account:['login','log in','sign in','password','account','email','profile'],
 human:['human','agent','representative','real person','someone','manager'],
 product:['recommend','suggest','looking for','find me','which product','best product','under $','budget'],
 payment:['payment','card','charged','charge','declined','billing'],
 thanks:['thanks','thank you','thx','appreciate']
};
function scoreIntent(text,key){const n=normalize(text);return intents[key].reduce((s,p)=>s+(n.includes(normalize(p))?Math.max(1,words(p).length):0),0)}
function classify(text){let best='unknown',score=0;for(const k of Object.keys(intents)){const s=scoreIntent(text,k);if(s>score){score=s;best=k}}return score?best:'unknown'}
function extractOrderId(text){const m=String(text).match(/(?:yooop[-\s]?)?\d{4,8}/i);return m?m[0].toUpperCase().replace(/\s/g,'').replace(/^(\d)/,'YOOOP-$1'):null}
function orders(){return read('yooop-orders',[])}
function profile(){return read('yooop-user',read('yooop-profile',{}))||{}}
function products(){return typeof PRODUCTS!=='undefined'?PRODUCTS:[]}
function findOrder(id){const list=orders();if(!id)return list[0]||null;const cleaned=id.replace(/[^0-9]/g,'');return list.find(o=>String(o.id).replace(/[^0-9]/g,'')===cleaned)||null}
function latestOrder(){return findOrder(state.orderId)||orders()[0]||null}
function add(role,text){chat.push({who:role,text});chat=chat.slice(-40);write('yooop-ai-chat',chat);render()}
function render(){const body=$('#aiBody');if(!body)return;if(!chat.length)chat=[{who:'agent',text:`Hi${profile().first?' '+esc(profile().first):''}! I’m YOOOP’s local support assistant. I can understand normal questions about orders, tracking, returns, refunds, damaged items, account help, and products.`}];body.innerHTML=chat.map(m=>`<div class="msg ${m.who==='user'?'user':'agent'}">${m.text}</div>`).join('');body.scrollTop=body.scrollHeight}
function action(label,href){return `<a class="btn btn-outline" href="${href}" style="margin:8px 6px 0 0">${label}</a>`}
function button(label,text){return `<button class="btn btn-outline" onclick="askAI('${String(text).replace(/'/g,"\\'")}')" style="margin:8px 6px 0 0">${label}</button>`}
function orderSummary(o){if(!o)return null;const itemCount=(o.items||[]).reduce((a,x)=>a+(Number(x.qty)||1),0);return `<b>${esc(o.id)}</b> · ${esc(o.status||'Processing')} · ${itemCount} item${itemCount===1?'':'s'} · ${esc(o.date||'')}`}
function recommend(text){const budget=Number((text.match(/(?:under|below|less than|max|budget)\s*\$?\s*(\d+(?:\.\d+)?)/i)||[])[1]);const tokens=words(text).filter(w=>w.length>2);let list=products().map(p=>({p,score:tokens.reduce((s,t)=>s+(`${p.name} ${p.cat} ${p.desc||''}`.toLowerCase().includes(t)?1:0),0)})).filter(x=>(!budget||x.p.price<=budget));list.sort((a,b)=>b.score-a.score||b.p.rating-a.p.rating);list=list.slice(0,3);if(!list.length)return `I couldn’t find a close match in the current catalog. Tell me the product type and your maximum budget.`;return `Here are the closest matches I found:<br>${list.map(x=>`<div style="margin-top:10px"><a href="product.html?id=${x.p.id}"><b>${esc(x.p.name)}</b></a> — $${x.p.price.toFixed(2)}</div>`).join('')}`}
function respond(raw){const text=String(raw||'').trim(), n=normalize(text);const id=extractOrderId(text);if(id){state.orderId=id;write('yooop-local-agent-state',state)}
 let intent=classify(text);
 if(intent==='unknown'&&state.pending){intent=state.pending}
 if(/^(yes|yeah|yep|correct|that one|latest|most recent)$/.test(n)&&state.pending)intent=state.pending;
 state.lastIntent=intent;
 const o=findOrder(id)||latestOrder();
 switch(intent){
 case 'greeting': state.pending=null;return `Hi${profile().first?' '+esc(profile().first):''}! What can I help you with today? You can describe the problem naturally.`;
 case 'tracking':
   if(!o){state.pending='tracking';return `I don’t see a saved order on this device. What is the order number? It usually looks like <b>YOOOP-10428</b>.`}
   state.pending=null;state.orderId=o.id;write('yooop-local-agent-state',state);return `I found ${orderSummary(o)}.<br><br>${o.status==='Delivered'?'It shows as delivered.':o.status==='In transit'?'It is moving through the carrier network.':'It is still being prepared.'}<br>${action('View full tracking',`tracking.html?id=${encodeURIComponent(o.id)}`)}${action('Open all orders','orders.html')}`;
 case 'return':
   if(!o){state.pending='return';return `I can help with a return. Which order is the item from? Send the order number or say “latest order.”`}
   state.pending='return_reason';return `I found ${orderSummary(o)}. Why are you returning it: damaged, wrong item, no longer needed, or another reason?`;
 case 'return_reason':
   state.pending=null;return `Thanks. I saved the reason as “${esc(text)}.” This local demo cannot issue a real label, but you can continue through customer service.${action('Open customer service','support.html')}${action('View order','orders.html')}`;
 case 'refund':
   if(!o){state.pending='refund';return `Which order needs a refund? Send its order number or say “my latest order.”`}
   state.pending=null;return `For ${orderSummary(o)}, a real refund would need payment-system access. I can still guide you: open the order, confirm the item and reason, then submit a support request.${action('Open order','orders.html')}${action('Refund support','support.html')}`;
 case 'damaged':
   if(!o){state.pending='damaged';return `I’m sorry. Which order had the damaged, missing, or wrong item?`}
   state.pending=null;return `I found ${orderSummary(o)}. Keep the packaging and take photos of the item and shipping label. I recommend opening a priority support case.${action('Create support case','support.html')}${action('Open messages','messages.html')}`;
 case 'cancel':
   if(!o){state.pending='cancel';return `Which order do you want to cancel?`}
   state.pending=null;return `${orderSummary(o)}. ${/processing|placed/i.test(o.status||'')?'It may still be cancelable because it has not shipped yet.':'It may be too late to cancel because fulfillment has started.'} This demo cannot change the real order.${action('Open order','orders.html')}${action('Request cancellation','support.html')}`;
 case 'address':
   state.pending=null;return `You can change your saved address in Account. For an order already placed, address changes depend on whether it has shipped.${action('Manage address','account.html')}${action('Contact support','support.html')}`;
 case 'account': state.pending=null;return `I can help with sign-in or profile details. This demo stores account information only on this device.${action('Sign in','login.html')}${action('Account settings','account.html')}`;
 case 'human': state.pending=null;return `I can send you to the human-support request form or messages.${action('Customer service','support.html')}${action('Messages','messages.html')}`;
 case 'product': state.pending=null;return recommend(text);
 case 'payment': state.pending=null;return `For payment problems, check the card number, billing ZIP, expiration date, and available balance. This demo checkout does not charge a real card.${action('Open checkout','checkout.html')}${action('Payment support','support.html')}`;
 case 'thanks': state.pending=null;return `You’re welcome. Is there anything else you need help with?`;
 default:
   state.pending=null;return `I’m not completely sure what you mean yet. Tell me whether this is about <b>an order, delivery, return, refund, damaged item, account, payment, or a product recommendation</b>. You can write it normally, like “my package is late and I need it Friday.”`;
 }
}
function typing(show){const body=$('#aiBody');if(!body)return;let el=$('#localTyping');if(show&&!el){el=document.createElement('div');el.id='localTyping';el.className='typing';el.innerHTML='<i></i><i></i><i></i>';body.append(el);body.scrollTop=body.scrollHeight}else if(!show&&el)el.remove()}
window.sendAI=function(e){e?.preventDefault();const inp=$('#aiInput');const text=inp?.value.trim();if(!text)return;add('user',esc(text));inp.value='';typing(true);setTimeout(()=>{typing(false);add('agent',respond(text))},350)};
window.askAI=function(text){const inp=$('#aiInput');if(inp)inp.value=text;window.sendAI({preventDefault(){}})};
window.clearChat=function(){chat=[];state.pending=null;state.orderId=null;write('yooop-ai-chat',chat);write('yooop-local-agent-state',state);render()};
document.addEventListener('DOMContentLoaded',()=>{render();const note=document.querySelector('.ai-side .notice');if(note)note.innerHTML='<b>Local smart assistant</b><br>Works without an API key. It uses saved orders, cart, profile, conversation memory, and natural-language intent matching.'});
})();