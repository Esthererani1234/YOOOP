(()=>{
'use strict';
const $=s=>document.querySelector(s);
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":"&#39;"}[c]));
const normalize=s=>String(s||'').toLowerCase().replace(/\b(wanna|gonna|cant|cannot|dont|didnt|doesnt|isnt|wasnt|wont|im|ive|id)\b/g,m=>({wanna:'want to',gonna:'going to',cant:'cannot',cannot:'cannot',dont:'do not',didnt:'did not',doesnt:'does not',isnt:'is not',wasnt:'was not',wont:'will not',im:'i am',ive:'i have',id:'i would'}[m])).replace(/[^a-z0-9$#-]+/g,' ').trim();
const words=s=>normalize(s).split(/\s+/).filter(Boolean);
const state=read('yooop-local-agent-state',{pending:null,orderId:null,itemId:null,lastIntent:null,lastTopic:null,details:{}});
let chat=read('yooop-ai-chat',[]);
const INTENTS={
 greeting:['hello','hi','hey','good morning','good afternoon','good evening'],
 tracking:['track','tracking','where is my order','where is package','delivery','package','shipment','arrive','arrival','late','delayed','not here','still waiting','eta'],
 return:['return','send back','exchange','do not want','changed my mind','return item','return this'],
 refund:['refund','money back','reimbursement','credit back','get my money'],
 damaged:['damaged','broken','cracked','defective','wrong item','missing item','not in box','never came','empty package','does not work'],
 cancel:['cancel','stop order','do not ship','cancel purchase'],
 address:['address','ship to','delivery location','wrong address','change location','move delivery'],
 account:['login','log in','sign in','password','account','email','profile','locked out'],
 human:['human','agent','representative','real person','manager','supervisor','someone help'],
 product:['recommend','suggest','looking for','find me','which product','best product','under $','budget','show me','need a'],
 payment:['payment','card','charged','charge','declined','billing','duplicate charge','pending charge'],
 thanks:['thanks','thank you','thx','appreciate'],
 policy:['policy','how long','return window','shipping time','warranty','buyer protection'],
 complaint:['terrible','awful','angry','upset','frustrated','ridiculous','scam','worst']
};
const SYN={track:['locate','status','eta'],refund:['money','credit'],return:['exchange','sendback'],damaged:['faulty','busted'],cancel:['stop'],account:['signin','password'],product:['buy','shop','recommendation']};
function levenshtein(a,b){a=normalize(a);b=normalize(b);const m=a.length,n=b.length,d=Array.from({length:m+1},()=>Array(n+1).fill(0));for(let i=0;i<=m;i++)d[i][0]=i;for(let j=0;j<=n;j++)d[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[m][n]}
function fuzzyHas(text,phrase){const n=normalize(text),p=normalize(phrase);if(n.includes(p))return true;const tw=words(n),pw=words(p);if(pw.length===1)return tw.some(w=>w.length>3&&levenshtein(w,pw[0])<=1);return false}
function scoreIntent(text,key){let score=0;for(const p of INTENTS[key])if(fuzzyHas(text,p))score+=Math.max(1,words(p).length*2);for(const p of SYN[key]||[])if(fuzzyHas(text,p))score+=1;return score}
function classify(text){const ranked=Object.keys(INTENTS).map(k=>[k,scoreIntent(text,k)]).sort((a,b)=>b[1]-a[1]);return {intent:ranked[0][1]?ranked[0][0]:'unknown',score:ranked[0][1],second:ranked[1]};}
function extractOrderId(text){const m=String(text).match(/(?:yooop[-\s#]?)?\d{4,8}/i);return m?m[0].toUpperCase().replace(/[\s#]/g,'').replace(/^(\d)/,'YOOOP-$1'):null}
function extractBudget(text){const m=String(text).match(/(?:under|below|less than|max(?:imum)?|budget(?: is| of)?|around)\s*\$?\s*(\d+(?:\.\d+)?)/i);return m?Number(m[1]):null}
function orders(){return read('yooop-orders',[])}
function profile(){return read('yooop-user',read('yooop-profile',{}))||{}}
function products(){return typeof PRODUCTS!=='undefined'?PRODUCTS:[]}
function cart(){return read('yooop-cart',{})}
function findOrder(id){const list=orders();if(!id)return list[0]||null;const cleaned=String(id).replace(/[^0-9]/g,'');return list.find(o=>String(o.id).replace(/[^0-9]/g,'')===cleaned)||null}
function latestOrder(){return findOrder(state.orderId)||orders()[0]||null}
function allOrderItems(o){return (o?.items||[]).map(x=>x.p||x.product||x).filter(Boolean)}
function resolveItem(text,o){const list=allOrderItems(o);if(!list.length)return null;const n=normalize(text);const exact=list.find(p=>n.includes(normalize(p.name)));if(exact)return exact;let best=null,bestScore=0;for(const p of list){const s=words(p.name).reduce((a,w)=>a+(n.includes(w)?1:0),0);if(s>bestScore){best=p;bestScore=s}}return bestScore?best:(list.length===1?list[0]:null)}
function add(role,text){chat.push({who:role,text});chat=chat.slice(-60);write('yooop-ai-chat',chat);render()}
function render(){const body=$('#aiBody');if(!body)return;if(!chat.length)chat=[{who:'agent',text:`Hi${profile().first?' '+esc(profile().first):''}! I’m YOOOP’s local support assistant. Tell me what happened in your own words and I’ll guide you step by step.`}];body.innerHTML=chat.map(m=>`<div class="msg ${m.who==='user'?'user':'agent'}">${m.text}</div>`).join('');body.scrollTop=body.scrollHeight}
function action(label,href){return `<a class="btn btn-outline" href="${href}" style="margin:8px 6px 0 0">${label}</a>`}
function button(label,text){return `<button class="btn btn-outline" onclick="askAI('${String(text).replace(/'/g,"\\'")}')" style="margin:8px 6px 0 0">${label}</button>`}
function orderSummary(o){if(!o)return null;const itemCount=(o.items||[]).reduce((a,x)=>a+(Number(x.qty)||1),0);return `<b>${esc(o.id)}</b> · ${esc(o.status||'Processing')} · ${itemCount} item${itemCount===1?'':'s'} · ${esc(o.date||'')}`}
function explainOrder(o){const s=normalize(o?.status||'processing');if(s.includes('deliver'))return 'The order shows as delivered.';if(s.includes('transit')||s.includes('ship'))return 'The package is moving through the carrier network.';if(s.includes('process')||s.includes('placed'))return 'The order is still being prepared.';return `The current status is ${esc(o?.status||'Processing')}.`}
function recommend(text){const budget=extractBudget(text);const stop=new Set(['find','show','need','want','best','good','cheap','something','product','under','below','around','with','for','that','this','please']);const tokens=words(text).filter(w=>w.length>2&&!stop.has(w));let list=products().map(p=>{const hay=`${p.name} ${p.cat} ${p.desc||''} ${p.tag||''}`.toLowerCase();let score=tokens.reduce((s,t)=>s+(hay.includes(t)?3:0),0);if(budget&&p.price<=budget)score+=2;if(/best|top|good/.test(normalize(text)))score+=Number(p.rating||0);return {p,score}}).filter(x=>(!budget||x.p.price<=budget));list.sort((a,b)=>b.score-a.score||Number(b.p.rating)-Number(a.p.rating));list=list.slice(0,4);if(!list.length)return `I couldn’t find a close match under ${budget?`$${budget}`:'that request'}. Tell me the category and your maximum budget.`;return `These are the best matches I found${budget?` under $${budget}`:''}:<br>${list.map(x=>`<div style="margin-top:10px"><a href="product.html?id=${x.p.id}"><b>${esc(x.p.name)}</b></a> — $${Number(x.p.price).toFixed(2)} · ${esc(x.p.rating||'')}★</div>`).join('')}`}
function chooseOrderPrompt(intent){const list=orders();if(!list.length)return `I don’t see any saved orders on this device. Send the order number if you have one, or open Your Orders.${action('Your orders','orders.html')}`;if(list.length===1){state.orderId=list[0].id;return null}state.pending=intent;return `Which order do you mean?<br>${list.slice(0,4).map(o=>button(`${o.id} · ${o.status}`,o.id)).join('')}`}
function createLocalCase(subject,o,item,details){const tickets=read('yooop-tickets',[]);const id='CASE-'+Math.floor(100000+Math.random()*899999);tickets.unshift({id,subject,orderId:o?.id||null,item:item?.name||null,details,status:'Open',date:new Date().toLocaleString()});write('yooop-tickets',tickets);return id}
function respond(raw){const text=String(raw||'').trim(),n=normalize(text),id=extractOrderId(text);if(id){state.orderId=id;write('yooop-local-agent-state',state)}
 const cls=classify(text);let intent=cls.intent;
 if(state.pending&&['yes','yeah','yep','correct','that one','latest','most recent','first one','second one'].includes(n))intent=state.pending;
 if(intent==='unknown'&&state.pending)intent=state.pending;
 if(cls.intent==='complaint'&&state.pending)intent=state.pending;
 state.lastIntent=intent;state.lastTopic=n;const o=findOrder(id)||latestOrder();const item=resolveItem(text,o)||resolveItem(state.details.itemText||'',o);
 if(item){state.itemId=item.id||item.name;state.details.itemText=item.name}
 switch(intent){
 case 'greeting':state.pending=null;return `Hi${profile().first?' '+esc(profile().first):''}! I can help with an order, delivery, return, refund, payment, account issue, or product recommendation. What happened?`;
 case 'complaint':return `I’m sorry this has been frustrating. I’ll help narrow it down. Is the problem with <b>delivery, the item itself, payment, or your account</b>?${button('Delivery problem','My delivery is late')}${button('Item problem','The item is damaged')}${button('Payment problem','I have a payment issue')}`;
 case 'tracking':{if(!o){const p=chooseOrderPrompt('tracking');if(p)return p}state.pending=null;state.orderId=o.id;write('yooop-local-agent-state',state);let extra='';if(/late|delayed|friday|today|tomorrow|urgent/.test(n))extra='<br><br>Because timing matters, check the detailed tracking page for the latest scan. If there has been no movement for several days, open a delivery case.';return `I found ${orderSummary(o)}.<br><br>${explainOrder(o)}${extra}<br>${action('View full tracking',`tracking.html?id=${encodeURIComponent(o.id)}`)}${action('Delivery help','support.html')}`}
 case 'return':{if(!o){const p=chooseOrderPrompt('return');if(p)return p}if(!item&&allOrderItems(o).length>1){state.pending='return_item';return `Which item from ${esc(o.id)} do you want to return?<br>${allOrderItems(o).map(p=>button(p.name,p.name)).join('')}`}state.pending='return_reason';state.details.itemText=item?.name||state.details.itemText||'';return `Got it${item?` — ${esc(item.name)}`:''}. Why are you returning it: damaged, wrong item, not as expected, or no longer needed?`}
 case 'return_item':state.details.itemText=text;state.pending='return_reason';return `Thanks. Why do you want to return ${esc(text)}?`;
 case 'return_reason':{state.pending=null;const reason=text;const caseId=createLocalCase('Return request',o,item||{name:state.details.itemText},reason);return `I created local return case <b>${caseId}</b> for ${o?esc(o.id):'your order'}${state.details.itemText?` · ${esc(state.details.itemText)}`:''}. Reason: “${esc(reason)}.” This demo cannot issue a real shipping label, but the case is saved for customer service.${action('Customer service','support.html')}${action('View orders','orders.html')}`}
 case 'refund':{if(!o){const p=chooseOrderPrompt('refund');if(p)return p}state.pending=null;return `For ${orderSummary(o)}, refunds normally go back to the original payment method after approval. This local agent cannot move money, but it can prepare the request.${button('Create refund case',`Create a refund case for ${o.id}`)}${action('Open order','orders.html')}`}
 case 'damaged':{if(!o){const p=chooseOrderPrompt('damaged');if(p)return p}if(!item&&allOrderItems(o).length>1){state.pending='damaged_item';return `Which item was damaged, missing, or incorrect?<br>${allOrderItems(o).map(p=>button(p.name,p.name)).join('')}`}const caseId=createLocalCase('Damaged, missing, or incorrect item',o,item,text);state.pending=null;return `I created priority case <b>${caseId}</b> for ${orderSummary(o)}${item?` · ${esc(item.name)}`:''}. Keep the packaging and take photos of the item and shipping label.${action('Open customer service','support.html')}${action('Messages','messages.html')}`}
 case 'damaged_item':{state.details.itemText=text;state.pending='damaged_details';return `What was wrong with ${esc(text)} — damaged, missing, incorrect, or not working?`}
 case 'damaged_details':{const caseId=createLocalCase('Item problem',o,{name:state.details.itemText},text);state.pending=null;return `I saved priority case <b>${caseId}</b>. Please keep the packaging and photos for support.${action('Customer service','support.html')}`}
 case 'cancel':{if(!o){const p=chooseOrderPrompt('cancel');if(p)return p}state.pending=null;const eligible=/processing|placed/i.test(o.status||'');return `${orderSummary(o)}.<br><br>${eligible?'It may still be cancelable because shipment has not started.':'It may be too late to cancel because fulfillment has already started.'} This local agent cannot alter a real order.${action('Open order','orders.html')}${action('Request cancellation','support.html')}`}
 case 'address':{const placed=/order|shipment|package/.test(n);state.pending=null;return placed?`For an order already placed, an address change depends on whether it has shipped. Update the saved address for future orders, and contact support immediately for this order.${action('Account address','account.html')}${action('Urgent support','support.html')}`:`You can update your default delivery address in Account.${action('Manage address','account.html')}`}
 case 'account':state.pending=null;return `For sign-in problems, try the login page. For name, phone, email, or address changes, open Account settings.${action('Sign in','login.html')}${action('Account settings','account.html')}`;
 case 'human':state.pending=null;return `I can prepare the issue and send you to customer service. Tell me the order number and what happened, or open the support form now.${action('Customer service','support.html')}${action('Messages','messages.html')}`;
 case 'product':state.pending=null;return recommend(text);
 case 'payment':state.pending=null;return /charged twice|duplicate/.test(n)?`A duplicate charge needs payment review. Check whether one charge is only pending; pending authorizations may disappear automatically. For a posted duplicate charge, contact payment support.${action('Payment support','support.html')}`:`Check the card number, expiration, CVV, billing ZIP, and available balance. This demo checkout does not charge a real card.${action('Checkout','checkout.html')}${action('Payment support','support.html')}`;
 case 'policy':state.pending=null;return `YOOOP’s demo policies currently show 30-day returns, buyer protection, and estimated delivery based on each product or tracking page. Real production policies should be connected to your backend and shown consistently at checkout.${action('Customer service','support.html')}`;
 case 'thanks':state.pending=null;return `You’re welcome. I can keep helping with the same order, or you can ask about something else.`;
 default:return `I understand part of that, but I need one detail to act correctly. Is this about <b>delivery, returning an item, getting a refund, a damaged item, cancelling, payment, account access, or finding a product</b>?${button('Delivery','My package is late')}${button('Return','I want to return an item')}${button('Product help','Find me a product')}`
 }
}
function typing(show){const body=$('#aiBody');if(!body)return;let el=$('#localTyping');if(show&&!el){el=document.createElement('div');el.id='localTyping';el.className='typing';el.innerHTML='<i></i><i></i><i></i>';body.append(el);body.scrollTop=body.scrollHeight}else if(!show&&el)el.remove()}
window.sendAI=function(e){e?.preventDefault();const inp=$('#aiInput');const text=inp?.value.trim();if(!text)return;add('user',esc(text));inp.value='';typing(true);setTimeout(()=>{typing(false);add('agent',respond(text));write('yooop-local-agent-state',state)},300+Math.min(700,text.length*8))};
window.askAI=function(text){const inp=$('#aiInput');if(inp)inp.value=text;window.sendAI({preventDefault(){}})};
window.clearChat=function(){chat=[];state.pending=null;state.orderId=null;state.itemId=null;state.lastIntent=null;state.details={};write('yooop-ai-chat',chat);write('yooop-local-agent-state',state);render()};
document.addEventListener('DOMContentLoaded',()=>{render();const note=document.querySelector('.ai-side .notice');if(note)note.innerHTML='<b>Advanced local support agent</b><br>Works without an API key. It uses fuzzy language matching, saved orders, item selection, conversation memory, multi-step workflows, product ranking, and local support cases.'});
})();