/* 서버에서 읽어 온 내 데이터를 화면 상태에 채워 넣어요 */
function hydrate(d){
  chs=d.chs;cur=null;
  LORE.world.items=d.world;LORE.codex.items=d.codex;
  memos=d.memos;wlog=d.wlog;lastEdit=d.lastEdit;
  const p=d.prefs,pick=(v,n,def)=>Number.isInteger(v)&&v>=0&&v<n?v:def;
  Object.assign(OPT,OPT_DEF,p.opt||{});
  size=pick(p.size,SIZES.length,1);fnt=pick(p.font,FONTS.length,0);lhi=pick(p.lh,LHS.length,1);gi=pick(p.goal,GOALS.length,1);
  base=p.base&&p.base.d===day?p.base:null;
  if(!base){base={d:day,s:tot()};db.pref('base',base)}
  wTitle=typeof p.title==='string'&&p.title?p.title:'새 원고';wGone=Array.isArray(p.gone)?p.gone:[];
  paintWorks();counts();notes();paintFmt();setSize(size,false);paintOpt();home();
}
/* 로그아웃 후 다른 계정이 들어와도 이전 데이터가 보이지 않도록 비워요 */
function resetState(){
  clearTimeout(timer);cur=null;le=null;chs=[];
  LORE.world.items=[];LORE.codex.items=[];memos=[];wlog={};lastEdit=0;base={d:day,s:0};
  ed.innerHTML='';ti.value='';fi.value='';EL.chs.innerHTML='';listHtml='';$('#fb').hidden=true;
  Object.assign(OPT,OPT_DEF);size=1;fnt=0;lhi=1;gi=1;
  wTitle='새 원고';wGone=[];wdq=null;paintWorks();
  counts();notes();paintFmt();paintOpt();db.reset();
}
/* 저장 상태 표시(편집 화면 위 · 설정 상세 아래) */
db.on(s=>{
  if(s==='rejected')return toast('저장할 수 없는 내용이 있어 건너뛰었어요.');
  if(s==='expired')return;
  const t=s==='saving'?'저장 중…':s==='error'?'저장 못 함 · 연결을 확인해 주세요':'저장됨';
  $('#st').textContent=t;$('#lost').textContent=t;
  if(s==='error')toast('서버에 저장하지 못했어요. 연결되면 다시 시도할게요.');
});
(async()=>{
  const resume=document.documentElement.classList;
  const unhide=setTimeout(()=>resume.remove('resume'),8000); /* 서버 응답이 느려도 로그인 화면은 보이게 */
  try{
    if(authStore.getItem('meari-token')){
      const d=await db.load();
      hydrate(d);
      setTheme(true);setUser(d.user.username);
      gate.hidden=true;$('#lg').classList.remove('intro');app.inert=false;app.classList.add('arrive');settle();
      return;
    }
  }catch(e){console.error('[meari] 자동 로그인 실패',e);resetState();if(e&&e.status===401){authStore.removeItem('meari-token');authStore.removeItem('meari-user')}}
  finally{clearTimeout(unhide);resume.remove('resume')}
  authStore.removeItem('meari-user');setTheme(false);login.intro();
})();
