/* Source-aligned motion for synthetic, browser-only events. No service connection. */
(function(){
  'use strict';
  const openState=new Map(),entered=new Set();let submitting=false,explicitScroll=false;
  const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
  const escapeId=value=>String(value).replace(/[^a-zA-Z0-9_-]/g,'-');
  function disclosure(key,label,nodes,open=false){
    const section=document.createElement('section');section.className='motion-disclosure';section.dataset.motionKey=key;
    const button=document.createElement('button');button.type='button';button.className='motion-disclosure-toggle';
    button.id='motion-toggle-'+escapeId(key);button.innerHTML='<span class="motion-chevron" aria-hidden="true">›</span><span></span>';button.lastElementChild.textContent=label;
    const region=document.createElement('div');region.className='motion-disclosure-region';region.id='motion-region-'+escapeId(key);button.setAttribute('aria-controls',region.id);
    const content=document.createElement('div');content.className='motion-disclosure-content';const inner=document.createElement('div');nodes.forEach(n=>inner.append(n));content.append(inner);region.append(content);section.append(button,region);
    function set(value){if(!value&&region.contains(document.activeElement))button.focus();section.dataset.open=String(value);button.setAttribute('aria-expanded',String(value));region.setAttribute('aria-hidden',String(!value));region.toggleAttribute('inert',!value);openState.set(key,value);}
    set(openState.has(key)?openState.get(key):open);button.onclick=()=>set(section.dataset.open!=='true');return section;
  }
  function decorate(){
    document.querySelectorAll('.agent-trace').forEach(trace=>{const key='trace-'+trace.dataset.trace;const summary=trace.querySelector('summary');if(!summary)return;const section=disclosure(key,summary.textContent,[...trace.children].filter(n=>n!==summary));section.classList.add('agent-trace');section.dataset.trace=trace.dataset.trace;trace.replaceWith(section);});
    document.querySelectorAll('.inspection-finding').forEach((card,i)=>{const nodes=[...card.children].filter(n=>n.tagName==='P');card.append(disclosure('eval-'+i,'查看判断理由（合成）',nodes));});
    const checkpoint=document.querySelector('[data-customer-checkpoint]');if(checkpoint){const p=document.createElement('p');p.textContent='只读来源：demo-conversation / service revision 4。合成 checkpoint；不查询真实客户。';checkpoint.append(disclosure('memory-checkpoint','查看记忆依据（合成）',[p]));}
    document.querySelectorAll('[data-memory-row]').forEach(card=>{const p=document.createElement('p');p.textContent='本页内存中的合成回执；没有外部写入，也没有读取真实服务。';card.append(disclosure('memory-'+card.dataset.memoryRow,'查看同步依据（合成）',[p]));});
    const evidence=document.querySelector('[aria-label="合成知识证据"]');if(evidence){const nodes=[...evidence.querySelectorAll(':scope > .inspection-kv')];evidence.append(disclosure('knowledge-evidence','查看证据版本与定位（合成）',nodes));}
    const wiki=document.querySelector('[data-wiki-evidence]');if(wiki){const nodes=[...wiki.querySelectorAll(':scope > .inspection-kv')];wiki.append(disclosure('wiki-evidence','查看 Wiki 版本依据（合成）',nodes));}
    document.querySelectorAll('[data-turn]').forEach(article=>{const id=article.dataset.turn;const d=state.runs.find(r=>r.id===id)||(state.detail?.id===id?state.detail:null);if(!d)return;const status=document.createElement('div');status.className='motion-status';status.dataset.state=d.status==='running'?(d.phase||'queued'):d.status;status.setAttribute('role','status');const labels={queued:'已接收 · 等待本地上下文',running:'执行中',completed:'本轮已结束',cancelled:'已取消',failed:'执行失败'};const title=document.createElement('strong');title.textContent=labels[status.dataset.state]||status.dataset.state;const note=document.createElement('small');note.textContent='合成事件演练 · 无模型 / 后端调用';status.append(title,note);article.querySelector('.assistant-label').after(status);});
    const welcome=document.querySelector('.agent-welcome');if(welcome){const p=document.createElement('p');p.className='motion-info';p.textContent='轻动效已加入：发送任务、查看执行记录，再从「证据与版本」展开依据。状态由本页合成事件驱动；系统减少动态效果设置会关闭动效。';welcome.append(p);}
  }
  // Preserve stable task and result nodes across the legacy full-page renderer.
  // Content changes do not replay entry motion; no token/poll/history animation.
  function sync(old,fresh){
    for(const name of [...old.attributes].map(a=>a.name))if(!fresh.hasAttribute(name)&&name!=='class')old.removeAttribute(name);
    for(const attr of fresh.attributes)if(attr.name!=='class')old.setAttribute(attr.name,attr.value);
    const animated=old.classList.contains('motion-new');old.className=fresh.className;if(animated)old.classList.add('motion-new');
    if(old.innerHTML!==fresh.innerHTML){
      const retained=[...old.querySelectorAll('[data-motion-key]')];old.innerHTML=fresh.innerHTML;
      for(const prior of retained){const next=[...old.querySelectorAll('[data-motion-key]')].find(n=>n.dataset.motionKey===prior.dataset.motionKey);if(next){const nextInner=next.querySelector('.motion-disclosure-content>div'),priorInner=prior.querySelector('.motion-disclosure-content>div');prior.querySelector('.motion-disclosure-toggle span:last-child').textContent=next.querySelector('.motion-disclosure-toggle span:last-child').textContent;if(priorInner.innerHTML!==nextInner.innerHTML)priorInner.innerHTML=nextInner.innerHTML;next.replaceWith(prior);}}
    }
    return old;
  }
  const priorRender=render;
  render=function(){
    const conversation=document.getElementById('agent-conversation'),oldScroll=conversation?.scrollTop||0;
    const follows=!conversation||conversation.scrollHeight-conversation.clientHeight-oldScroll<=48;
    const turns=new Map([...document.querySelectorAll('[data-turn]')].map(n=>[n.dataset.turn,n]));
    const disclosures=new Map([...document.querySelectorAll('[data-motion-key]')].map(n=>[n.dataset.motionKey,n]));
    const active=document.activeElement,activeId=active?.id,send=document.getElementById('run-button');
    for(const old of turns.values())old.classList.remove('motion-new');if(send)send.classList.remove('motion-pressed');
    priorRender();decorate();
    document.querySelectorAll('[data-turn]').forEach(fresh=>{
      const key=fresh.dataset.turn,old=turns.get(key);
      if(old){
        // Keep article + task + result shell identities stable for a single local run.
        const user=old.querySelector('.user-message'),assistant=old.querySelector('.assistant-message');
        sync(assistant,fresh.querySelector('.assistant-message'));fresh.querySelector('.user-message').replaceWith(user);fresh.querySelector('.assistant-message').replaceWith(assistant);old.replaceChildren(...fresh.childNodes);fresh.replaceWith(old);
      }else if(submitting&&!entered.has(key)){entered.add(key);if(!reduced()){fresh.classList.add('motion-new');fresh.addEventListener('animationend',()=>fresh.classList.remove('motion-new'),{once:true});}}
    });
    document.querySelectorAll('[data-motion-key]').forEach(next=>{const old=disclosures.get(next.dataset.motionKey);if(old&&old!==next&&old.querySelector('.motion-disclosure-content').innerHTML===next.querySelector('.motion-disclosure-content').innerHTML)next.replaceWith(old);});
    const nextSend=document.getElementById('run-button');if(send&&nextSend){send.disabled=nextSend.disabled;nextSend.replaceWith(send);}
    const current=document.getElementById('agent-conversation');if(current)current.scrollTop=explicitScroll||follows?current.scrollHeight:oldScroll;
    if(activeId&&document.getElementById(activeId))document.getElementById(activeId).focus({preventScroll:true});
    bindAgentChat();
  };
  const priorRun=runAgent;runAgent=function(){submitting=true;explicitScroll=true;let result;try{result=priorRun();}finally{submitting=false;explicitScroll=false;}if(result){const button=document.getElementById('run-button');if(button&&!reduced()){button.classList.remove('motion-pressed');button.classList.add('motion-pressed');button.addEventListener('animationend',()=>button.classList.remove('motion-pressed'),{once:true});}}return result;};
  document.addEventListener('click',e=>{if(e.target.closest('[data-run],[data-action="new-chat"]')){explicitScroll=true;queueMicrotask(()=>{explicitScroll=false;});}},true);
  window.CRM_MOTION={timings:{entry:160,press:100,disclosure:190},synthetic:true,reduced};render();
})();
