/* 메아리 ↔ 서버(Supabase Edge Function `meari-api`) 통신 계층.
   화면 코드는 메모리 상태(chs, LORE, memos …)를 그대로 쓰고, 바뀔 때마다 db.* 로 알려 서버에 반영해요.
   저장은 순서대로 한 건씩 보내고, 실패하면 다시 시도해요(큐가 남아 있는 동안 창을 닫으려 하면 경고). */

/* ── 로그인 토큰 저장소: '기억하기'를 켰으면 localStorage, 아니면 이 탭(sessionStorage)에만 ── */
const authStore=(()=>{
  const g=(s,k)=>{try{return s.getItem(k)}catch(e){return null}};
  const rm=()=>g(localStorage,'meari-rm')==='1';
  return{
    getItem:k=>g(sessionStorage,k)??g(localStorage,k),
    setItem:(k,v)=>{try{(rm()?localStorage:sessionStorage).setItem(k,v)}catch(e){}},
    removeItem:k=>{try{localStorage.removeItem(k)}catch(e){}try{sessionStorage.removeItem(k)}catch(e){}}
  };
})();

const API=(typeof SB_URL==='string'&&/^https?:\/\//.test(SB_URL)&&!/YOUR/i.test(SB_URL))?SB_URL.replace(/\/+$/,'')+'/functions/v1/meari-api':null;
if(!API)console.warn('[meari] 서버 주소가 비어 있어요. js/config.js 의 SB_URL 을 채워 주세요.');
const ERR={
  bad:'아이디 또는 암호가 일치하지 않아요. 다시 확인해 주세요.',taken:'이미 사용 중인 아이디예요.',
  rate:'시도가 너무 많아요. 잠시 후 다시 시도해 주세요.',invalid:'아이디 또는 암호 형식이 올바르지 않아요.',
  unauth:'로그인이 풀렸어요. 다시 로그인해 주세요.',big:'내용이 너무 커서 처리할 수 없어요.',
  net:'서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.',cfg:'서버 설정이 필요해요. js/config.js 를 확인해 주세요.',
  server:'서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.'
};
/* 서버 호출. 실패하면 {k:코드, t:화면용 문장, status} 를 던져요 */
async function api(op,body){
  if(!API)throw{k:'cfg',t:ERR.cfg,status:0};
  let r;
  try{r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op,token:authStore.getItem('meari-token')||undefined,...body})})}
  catch(e){throw{k:'net',t:ERR.net,status:0}}
  let j=null;try{j=await r.json()}catch(e){}
  if(r.ok&&j&&j.ok)return j;
  const k=(j&&j.code)||'server';
  throw{k,t:ERR[k]||ERR.server,status:r.status};
}

/* ── 계정: 아이디 + 암호. 이메일은 쓰지 않아요 ── */
const account={
  async signIn(name,pw,rm){return enter(await api('login',{username:name,password:pw}),rm)},
  async signUp(name,pw,rm){return enter(await api('signup',{username:name,password:pw}),rm)},
  async signOut(){
    try{await api('logout')}catch(e){}
    authStore.removeItem('meari-token');authStore.removeItem('meari-user');
    try{localStorage.removeItem('meari-rm')}catch(e){}
  }
};
function enter(j,rm){
  try{localStorage.setItem('meari-rm',rm?'1':'0')}catch(e){}
  authStore.removeItem('meari-token');authStore.setItem('meari-token',j.token);
  return j.user;
}

/* ── 데이터 ── */
const db=(()=>{
  let on=false,q=[],busy=false,fails=0,subs=[],prefs={};
  const emit=s=>subs.slice().forEach(f=>f(s));
  const iso=t=>new Date(t||Date.now()).toISOString();
  const chunk=(a,n)=>{const r=[];for(let i=0;i<a.length;i+=n)r.push(a.slice(i,i+n));return r};
  /* 서버는 한 번에 50건까지만 받아서, 많으면 나눠서 순서대로 보내요 */
  const w=ops=>ops.length?chunk(ops,50).reduce((p,c)=>p.then(()=>api('write',{ops:c})),Promise.resolve()):null;

  function run(){
    if(busy||!q.length||!on)return;
    busy=true;emit('saving');
    Promise.resolve().then(q[0].fn).then(()=>{
      q.shift();fails=0;busy=false;
      q.length?run():emit('saved');
    }).catch(e=>{
      busy=false;
      if(e&&e.status===401){q=[];on=false;emit('expired');return}              /* 로그인이 풀림 */
      if(e&&(e.status===400||e.status===413)){                                  /* 다시 보내도 소용없는 내용은 버려요 */
        console.error('[meari] 저장할 수 없는 내용',e);q.shift();emit('rejected');
        q.length?run():emit('saved');return;
      }
      console.error('[meari] 저장 실패',e);fails++;
      if(fails>=3){emit('error');return}   /* 큐는 그대로 두고, 다음 저장이나 온라인 복귀 때 다시 시도 */
      setTimeout(run,1200*fails);
    });
  }
  /* fn 은 실행 시점의 최신 상태를 읽어요. 같은 키가 대기열 끝에 있으면 한 번만 보내면 돼서 합쳐요 */
  function enqueue(key,fn){
    if(!on)return;
    const t=q[q.length-1];
    if(!(t&&t.key===key&&!(busy&&q.length===1)))q.push({key,fn});
    fails=0;run();
  }
  addEventListener('online',()=>{fails=0;run()});

  const rowCh=(c,i)=>({id:c.id,n:c.n,title:c.t,body:c.c,pos:i});
  const rowLo=(k,x)=>({kind:k,id:x.id,cat:x.c,title:x.t,body:x.b,pos:x.p||0});

  /* 처음 가입한 계정에 넣어 줄 기본 내용 (state.js 의 SEED_CHS, works.js 의 LORE.seed, SEED_MEMOS) */
  async function seed(){
    const chs0=SEED_CHS.map(c=>({...c,_sig:c.t+'\0'+c.c})),
      lore0={world:LORE.world.seed.map((x,i)=>({...x,p:i})),codex:LORE.codex.seed.map((x,i)=>({...x,p:i}))},
      memos0=SEED_MEMOS.map((m,i)=>({id:i+1,t:m,at:Date.now()-864e5}));
    await api('write',{ops:[
      {t:'ch',rows:chs0.map(rowCh)},
      ...(lore0.world.length+lore0.codex.length?[{t:'lo',rows:[...lore0.world.map(x=>rowLo('world',x)),...lore0.codex.map(x=>rowLo('codex',x))]}]:[]),
      ...(memos0.length?[{t:'me',rows:memos0.map(m=>({id:m.id,t:m.t,at:iso(m.at)}))}]:[]),
      {t:'prefs',data:{}}   /* 마지막에 넣어서 "준비 끝" 표시로 씀 */
    ]});
    return{chs:chs0,world:lore0.world,codex:lore0.codex,memos:memos0,wlog:{},prefs:{},lastEdit:0};
  }

  return{
    on:f=>{subs.push(f)},
    pending:()=>q.length>0||busy,
    /* 로그인 직후 한 번: 내 데이터를 전부 읽어 와요. 처음이면 기본 내용을 채워요. 로그인 토큰이 없거나 만료면 던져요 */
    async load(){
      q=[];busy=false;fails=0;
      const j=await api('load');
      on=true;
      if(!j.settings){const d=await seed();prefs=d.prefs;return{...d,user:j.user}}
      const lore=k=>j.lore.filter(r=>r.kind===k).map(r=>({id:r.id,c:r.cat,t:r.title,b:r.body,p:r.pos}));
      prefs=j.settings.data||{};
      const wlog={};j.log.forEach(r=>{wlog[r.day]=r.chars});
      let chs1=j.chapters.map(r=>({id:r.id,n:r.n,t:r.title,c:r.body,_sig:r.title+'\0'+r.body}));
      if(!chs1.length){ /* 화가 하나도 없는 비정상 상태: 빈 1화를 만들어 둠 */
        const c={id:Date.now(),n:1,t:'',c:'',_sig:'\0'};chs1=[c];
        await api('write',{ops:[{t:'ch',rows:[rowCh(c,0)]}]});
      }
      return{
        user:j.user,chs:chs1,world:lore('world'),codex:lore('codex'),
        memos:j.memos.map(r=>({id:r.id,t:r.t,at:new Date(r.at).getTime()})),
        wlog,prefs,
        lastEdit:j.chapters.reduce((m,r)=>Math.max(m,new Date(r.updated_at).getTime()||0),0)
      };
    },
    /* 로그아웃 때: 대기 중인 저장이 모두 끝날 때까지 기다려요(실패하면 reject) */
    flush(){return new Promise((res,rej)=>{
      if(!q.length&&!busy)return res();
      const f=s=>{if(s==='saved'||s==='error'||s==='expired'){subs=subs.filter(x=>x!==f);s==='saved'?res():rej(new Error('save'))}};
      subs.push(f);fails=0;run();
    })},
    reset(){on=false;q=[];busy=false;fails=0;prefs={}},

    /* 원고 통째로 삭제/복원 (화·세계관·설정집) */
    dropWork(items){enqueue('drop:'+Date.now()+Math.random(),()=>w(items.map(x=>x.ch?{t:'ch-del',id:x.ch}:{t:'lo-del',kind:x.k,id:x.id})))},
    restoreWork(){enqueue('restore:'+Date.now()+Math.random(),()=>w([
      ...chunk(chs.map(rowCh),50).map(rows=>({t:'ch',rows})),
      ...chunk([...LORE.world.items.map(x=>rowLo('world',x)),...LORE.codex.items.map(x=>rowLo('codex',x))],50).map(rows=>({t:'lo',rows}))]))},

    chapter(c){enqueue('ch:'+c.id,()=>chs.includes(c)?w([{t:'ch',rows:[rowCh(c,chs.indexOf(c))]}]):null)},
    chapters(){enqueue('chs',()=>w(chunk(chs.map((c,i)=>({id:c.id,n:c.n,title:c.t,pos:i})),200).map(rows=>({t:'ch-meta',rows}))))},   /* 번호·제목·순서(본문 제외) */
    delChapter(id){enqueue('delch:'+id,()=>w([{t:'ch-del',id}]))},

    lore(k,x){enqueue('lo:'+k+':'+x.id,()=>LORE[k].items.includes(x)?w([{t:'lo',rows:[rowLo(k,x)]}]):null)},
    delLore(k,id){enqueue('dello:'+k+':'+id,()=>w([{t:'lo-del',kind:k,id}]))},

    memoAdd(m){enqueue('me:'+m.id,()=>w([{t:'me',rows:[{id:m.id,t:m.t,at:iso(m.at)}]}]))},
    memoDel(id){enqueue('delme:'+id,()=>w([{t:'me-del',id}]))},

    log(d){enqueue('log:'+d,()=>w([{t:'log',day:d,chars:wlog[d]||0}]))},

    pref(k,v){prefs[k]=v;enqueue('prefs',()=>w([{t:'prefs',data:prefs}]))}
  };
})();
