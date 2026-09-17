const $=id=>document.getElementById(id), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let items=structuredClone(Engine.demo),cfg={...Engine.defaults},result=null,dirty=false;
const names={width:'可用装载宽度',autoAngle:'倾角处理',length:'可用车长',deck:'车架高度',angle:'偏离竖直倾角 °',aisle:'中央通道 mm',rebar:'每端出筋 mm',rowGap:'前后排间隙 mm',edge:'每侧车边余量 mm',rackW:'架底宽 mm',rackL:'架底长 mm',core:'架体中部净占宽 mm',support:'板底离车面 mm',rackWeight:'每架自重 t'};
function field(k){const opts=k==='width'?[[2500,'2.5 m'],[2400,'2.4 m']]:k==='autoAngle'?[[1,'四件优先 · 估算倾角'],[0,'按固定倾角']]:k==='length'?[[12000,'12 m'],[9000,'9 m']]:k==='deck'?[[900,'0.9 m'],[1200,'1.2 m']]:null;return `<label>${names[k]}${opts?`<select id="c_${k}">${opts.map(([v,t])=>`<option value="${v}" ${cfg[k]===v?'selected':''}>${t}</option>`).join('')}</select>`:`<input id="c_${k}" type="number" min="0" ${k==='angle'?'max="10"':''} step="${k==='rackWeight'?'0.01':k==='angle'?'0.1':'1'}" value="${cfg[k]??''}" placeholder="待核实">`}</label>`;}
function renderInputs(){ $('fields').innerHTML=['length','deck','width','autoAngle','angle','aisle','rebar','rowGap','edge'].map(field).join('');$('rackFields').innerHTML=Engine.optional.map(field).join('');renderItems();syncAngleUI();}
function syncAngleUI(){ $('c_angle').disabled=$('c_autoAngle').value==='1';$('c_angle').title=$('c_autoAngle').value==='1'?'自动反算值；切换按固定倾角后可编辑':'';}
function renderItems(){ $('items').innerHTML=items.map((p,i)=>`<tr data-i="${i}">${['name','l','h','t','w','q'].map(k=>`<td><input aria-label="第${i+1}行 ${k==='name'?'编号':({l:'板长',h:'高度',t:'板厚',w:'重量',q:'数量'})[k]}" data-k="${k}" type="${k==='name'?'text':'number'}" ${k==='name'?'maxlength="60"':`min="${k==='w'?0.01:1}" step="${k==='w'?0.01:1}"`} value="${esc(p[k])}"></td>`).join('')}<td><button class="smallbutton" data-del="${i}" aria-label="删除${esc(p.name)}">×</button></td></tr>`).join('');total();}
function total(){const n=items.reduce((s,p)=>s+(Number.isFinite(p.q)?p.q:0),0),w=items.reduce((s,p)=>s+(Number.isFinite(p.q*p.w)?p.q*p.w:0),0);$('inputTotal').textContent=`${n} 件 · 构件合计 ${w.toFixed(2)} t`;}
function readCfg(){const c={...Engine.defaults};for(const k of Object.keys(names)){const raw=$('c_'+k).value;c[k]=raw===''?(Engine.optional.includes(k)?null:NaN):Number(raw);}return c;}
function setDirty(){dirty=true;total();$('inputStatus').className='notice dirty';$('inputStatus').textContent='参数已修改。请重新配车，下面旧方案已隐藏。';$('result').innerHTML='';result=null;}
$('items').addEventListener('input',e=>{const el=e.target;if(!el.dataset.k)return;const i=Number(el.closest('tr').dataset.i),k=el.dataset.k;items[i][k]=k==='name'?el.value:(el.value===''?NaN:Number(el.value));setDirty();});
$('items').addEventListener('click',e=>{if(e.target.dataset.del===undefined)return;items.splice(Number(e.target.dataset.del),1);renderItems();setDirty();});
for(const id of ['fields','rackFields'])$(id).addEventListener('input',()=>{syncAngleUI();setDirty();});
$('add').onclick=()=>{items.push({id:'new'+Date.now(),name:'新构件',l:2000,h:3500,t:150,w:1,q:1});renderItems();setDirty();};
$('demo').onclick=()=>{items=structuredClone(Engine.demo);cfg={...Engine.defaults};renderInputs();calculate();};
function calculate(){try{cfg=readCfg();result=Engine.solve(cfg,items);cfg=result.config;$('c_angle').value=cfg.angle;dirty=false;renderResult();$('inputStatus').className='notice good';$('inputStatus').textContent='试排已更新。下方逐车显示已知冲突与待核实项目。';}catch(e){result=null;$('result').innerHTML='';$('inputStatus').className='notice danger';$('inputStatus').textContent=e.message;}}
$('calculate').onclick=calculate;
const palette=['#487f70','#5c7297','#9a7956','#798555','#986e83','#527e89','#8a775d','#64765d','#807898'];
const color=p=>palette[Number(p.id.split(':')[0])%palette.length];
function rect(x,y,w,h,fill,extra=''){return `<rect x="${x}" y="${y}" width="${Math.max(0,w)}" height="${Math.max(0,h)}" fill="${fill}" ${extra}/>`;}
function textSvg(x,y,t,size=12,fill='#405c4b',extra=''){return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${esc(t)}</text>`;}
function topSvg(rows){
  const m=Engine.metrics(rows,cfg),maxL=Math.max(cfg.length,m.length),s=700/maxL,ox=55,oy=40,bw=cfg.width*s;
  let svg=rect(ox,oy,cfg.length*s,bw,'#edf1e9','stroke="#9bab98" stroke-width="2"')+textSvg(ox,25,`可用车长 ${cfg.length} mm →`,12)+textSvg(ox+cfg.length*s/2,oy+bw+30,`车宽 ${cfg.width} mm`,12,'#405c4b','text-anchor="middle"');
  let x=0;
  rows.forEach((row,ri)=>{
    const totalW=row.width-2*cfg.edge;let y=(cfg.width-totalW)/2;
    row.racks.forEach((r,rj)=>{
      svg+=rect(ox+x*s,oy+y*s,row.length*s,r.width*s,'#dbe5d3','stroke="#95ac86" stroke-dasharray="5 3"');
      let py=y+(r.width-r.ps.reduce((sum,p)=>sum+Engine.geom(p,cfg).width,0)-(cfg.core??0))/2;
      r.ps.forEach((p,pi)=>{
        if(pi===1)py+=cfg.core??0;const g=Engine.geom(p,cfg);
        svg+=rect(ox+x*s,oy+py*s,g.length*s,g.width*s,'none',`stroke="${color(p)}" stroke-dasharray="3 3"`);
        svg+=rect(ox+(x+cfg.rebar)*s,oy+py*s,p.l*s,g.width*s,color(p),'opacity="0.72"');
        svg+=textSvg(ox+(x+cfg.rebar+p.l/2)*s,oy+(py+g.width/2)*s+4,p.name,10,'#fff','text-anchor="middle"');py+=g.width;
      });
      y+=r.width;
      if(rj===0&&row.racks.length===2){svg+=rect(ox+x*s,oy+y*s,row.length*s,cfg.aisle*s,'#fff1cb');y+=cfg.aisle;}
    });
    svg+=textSvg(ox+(x+row.length/2)*s,oy+bw+15,`排${ri+1} · ${Math.ceil(row.length)}`,10,'#587051','text-anchor="middle"');x+=row.length+cfg.rowGap;
  });
  return `<svg role="img" aria-label="车辆俯视图，虚线包含两端出筋及倾斜包络" viewBox="0 0 810 ${bw+100}">${svg}</svg>`;
}
function sectionSvg(row){
  const s=.071,ox=35,oy=365;const totalW=row.width-2*cfg.edge;let y=(cfg.width-totalW)/2,svg='';
  svg+=rect(ox,oy-cfg.deck*s,cfg.width*s,cfg.deck*s,'#c8d2c0');
  const limitY=oy-cfg.limitH*s;svg+=`<path d="M12 ${limitY}H310" stroke="#be7551" stroke-dasharray="5 4"/>`+textSvg(210,limitY-6,'4600 限高',10,'#ad5739');
  svg+=`<path d="M${ox} 22V${oy}M${ox+cfg.width*s} 22V${oy}" stroke="#acbba4" stroke-dasharray="3 4"/>`;
  row.racks.forEach((r,rj)=>{
    let py=y+(r.width-r.ps.reduce((sum,p)=>sum+Engine.geom(p,cfg).width,0)-(cfg.core??0))/2;
    const a=cfg.angle*Math.PI/180,baseY=oy-(cfg.deck+(cfg.support??0))*s;
    r.ps.forEach((p,pi)=>{
      if(pi===1)py+=cfg.core??0;const dx=p.h*Math.sin(a),dz=p.h*Math.cos(a),tx=p.t*Math.cos(a),tz=p.t*Math.sin(a);
      const pts=pi===0?[[py,0],[py+tx,tz],[py+tx+dx,tz+dz],[py+dx,dz]]:[[py,dz],[py+tx,dz+tz],[py+tx+dx,tz],[py+dx,0]];
      svg+=`<polygon points="${pts.map(([x,z])=>`${ox+x*s},${baseY-z*s}`).join(' ')}" fill="${color(p)}" stroke="${color(p)}"/>`;
      svg+=textSvg(ox+(py+Engine.geom(p,cfg).width/2)*s,baseY+14,p.name,8,'#405c4b','text-anchor="middle"');py+=Engine.geom(p,cfg).width;
    });
    y+=r.width;if(rj===0&&row.racks.length===2){svg+=rect(ox+y*s,oy-cfg.deck*s-140,cfg.aisle*s,120,'#f1d78a','opacity=".4"');svg+=textSvg(ox+(y+cfg.aisle/2)*s,oy-cfg.deck*s-146,`${cfg.aisle}`,9,'#8e6a23','text-anchor="middle"');y+=cfg.aisle;}
  });
  svg+=textSvg(ox,390,`包络总宽 ${Math.ceil(row.width)} / ${cfg.width} mm`,11);svg+=textSvg(ox,409,`倾角 ${cfg.angle}° · 架体未绘制实形`,10,'#788573');
  return `<svg role="img" aria-label="所选排的横向剖面，展示板体倾斜和限高" viewBox="0 0 330 425">${svg}</svg>`;
}
function truckChecks(rows){const m=Engine.metrics(rows,cfg),errors=[];if(m.weight>20+1e-7)errors.push(`超重 ${(m.weight-20).toFixed(2)} t`);if(m.length>cfg.length+1e-7)errors.push(`超长 ${Math.ceil(m.length-cfg.length)} mm`);if(rows.some(r=>r.width>cfg.width+1e-7))errors.push('横向超宽');return errors;}
function renderResult(){
  const n=result.trucks.length,totalWeight=result.all.reduce((s,p)=>s+p.w,0),pending=result.pending.length>0;
  let html=`<div class="sectionbar"><h2>03 / ${result.manual?'人工调整后的':'自动'}试排方案</h2><span class="badge">${pending?'运输架参数待核实':'几何模型试排'} · ${cfg.length/1000} m车架 ${cfg.deck/1000} m</span></div><div class="stats"><div class="stat"><strong>${n}</strong><span>已分配车辆 · 非最优证明</span></div><div class="stat"><strong>${result.all.length-result.rejected.length} / ${result.all.length}</strong><span>已分配构件</span></div><div class="stat"><strong>${totalWeight.toFixed(2)} <small>t</small></strong><span>输入构件总重量</span></div><div class="stat"><strong>${result.rejected.length}</strong><span>已知超限 · 未分配</span></div></div>`;
  if(cfg.autoAngle)html+=`<div class="notice"><strong>四件优先试排：估算倾角 ${cfg.angle}°。</strong>按最宽四件及${cfg.width} mm车宽反算，尚未确认运输架允许这个倾角。可切换“按固定倾角”核对现场实际摆法。</div>`;
  if(pending)html+=`<div class="notice">待核实：${result.pending.map(k=>names[k]).join('、')}。空值仅在下界计算中暂按0处理；所有车辆仍为试排。重量${cfg.rackWeight===null?'不含运输架自重':'已含所填运输架自重'}。</div>`;
  html+=`<div class="notice">优先两架四件一排，余件另排；已知超重或超尺寸时拆分。${cfg.angle}°倾角下，3500 × 150 mm单板横向包络约 ${Math.ceil(Engine.geom({l:1000,h:3500,t:150},cfg).width)} mm。采用保守包络，不允许板体、出筋或通道重叠。未校核轴荷、支承与绑扎。</div>`;
  if(result.rejected.length)html+=`<div class="notice danger"><strong>以下构件未分配</strong>${result.rejected.map(({p,reasons})=>`<div>${esc(p.name)}：${esc(reasons.join('；'))}</div>`).join('')}</div>`;
  if(!n)html+='<div class="card empty">当前参数下没有可试排的构件，请调整车辆或构件参数。</div>';
  result.trucks.forEach((rows,ti)=>{
    const m=Engine.metrics(rows,cfg),ps=rows.flatMap(r=>r.ps),height=Math.max(...ps.map(p=>Engine.geom(p,cfg).height)),errors=truckChecks(rows);
    html+=`<article class="card truckcard"><div class="truckhead"><div><div class="eyebrow" style="color:#77906c">TRUCK ${String(ti+1).padStart(2,'0')}</div><h3>第 ${ti+1} 车　${ps.length} 件 / ${m.racks} 架 / ${rows.length} 排</h3></div><span class="badge">${errors.length?'存在超限':(pending||cfg.autoAngle)?'待核实':'已填尺寸与重量符合模型上限'}</span></div>${errors.length?`<div class="notice danger">${errors.join('；')}。请移动构件或重新自动配车。</div>`:''}<p>${cfg.rackWeight===null?'构件重量':'含架重量'} <strong>${m.weight.toFixed(2)} / 20 t</strong>　·　占用长度 <strong>${Math.ceil(m.length)} / ${cfg.length} mm</strong>　·　${cfg.support===null?'总高下界':'总高'} <strong>${Math.ceil(height)} / 4600 mm</strong></p><div class="diagrams"><div class="figure"><h3>俯视 · 车长方向 →</h3>${topSvg(rows)}<div class="legend"><span><i class="line"></i>板体倾斜投影</span><span><i class="line dash"></i>含出筋／架体包络</span><span>浅黄：中央通道</span></div></div><div class="figure"><div class="sectionbar"><h3>横向剖面</h3><select class="noprint" aria-label="查看第${ti+1}车剖面排号" data-section="${ti}" style="width:100px">${rows.map((_,i)=>`<option value="${i}">第 ${i+1} 排</option>`).join('')}</select></div><div id="section_${ti}">${sectionSvg(rows[0])}</div></div></div><div class="scroll"><table class="trucktable"><thead><tr><th>构件</th><th>排／架／侧</th><th>板长＋出筋</th><th>总高度</th><th>重量 t</th><th class="noprint">移到车辆</th></tr></thead><tbody>${rows.map((r,ri)=>r.racks.map((rk,rki)=>rk.ps.map((p,pi)=>`<tr><td><strong>${esc(p.name)}</strong></td><td>${ri+1} / ${rki+1} / ${pi===0?'A':'B'}</td><td>${p.l}＋${cfg.rebar*2} mm</td><td>${p.h} mm</td><td>${p.w.toFixed(2)}</td><td class="noprint"><select aria-label="移动${esc(p.name)}到车辆" data-move="${p.id}" data-from="${ti}">${Array.from({length:n+1},(_,j)=>`<option value="${j}" ${j===ti?'selected':''}>${j===n?'新车':'第'+(j+1)+'车'}</option>`).join('')}</select></td></tr>`).join('')).join('')).join('')}</tbody></table></div></article>`;
  });$('result').innerHTML=html;
}
$('result').addEventListener('change',e=>{const el=e.target;if(el.dataset.section!==undefined){const ti=Number(el.dataset.section);$('section_'+ti).innerHTML=sectionSvg(result.trucks[ti][Number(el.value)]);}
  if(el.dataset.move){const from=Number(el.dataset.from),to=Number(el.value);if(from===to)return;const groups=result.trucks.map(rs=>rs.flatMap(r=>r.ps));const p=groups[from].find(p=>p.id===el.dataset.move);groups[from]=groups[from].filter(wall=>wall.id!==p.id);if(!groups[to])groups[to]=[];groups[to].push(p);result.trucks=groups.filter(g=>g.length).map(g=>Engine.repackManual(g,cfg));result.manual=true;renderResult();}
});
function toast(t){$('toast').textContent=t;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',4000);}
$('print').onclick=()=>{if(!result||dirty){toast('请先生成当前参数的试排方案。');return;}window.print();};
$('save').onclick=()=>{try{const c=readCfg();Engine.validate(c,items);const payload={version:1,config:c,items,groups:result&&!dirty?result.trucks.map(rs=>rs.flatMap(r=>r.ps.map(p=>p.id))):null};const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));a.href=url;a.download='外墙装车方案-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('方案已下载，可用“打开方案”恢复。');}catch(e){toast(e.message);}};
$('load').onclick=()=>$('file').click();
$('file').onchange=async()=>{const f=$('file').files[0];if(!f)return;try{if(f.size>1000000)throw Error('方案文件过大。');const data=JSON.parse(await f.text());if(data.version!==1)throw Error('不是本工具的方案文件。');const c={...Engine.defaults,...data.config,autoAngle:data.config?.autoAngle??0};Engine.validate(c,data.items);const candidate=Engine.solve(c,data.items);if(data.groups){if(!Array.isArray(data.groups)||data.groups.some(g=>!Array.isArray(g)||!g.length))throw Error('分车数据无效。');const pool=new Map(candidate.trucks.flatMap(rs=>rs.flatMap(r=>r.ps)).map(p=>[p.id,p]));const ids=data.groups.flat();if(ids.length!==pool.size||new Set(ids).size!==ids.length||ids.some(id=>!pool.has(id)))throw Error('分车记录与构件清单不一致。');candidate.trucks=data.groups.map(g=>Engine.repackManual(g.map(id=>pool.get(id)),candidate.config));candidate.manual=true;}cfg=candidate.config;items=data.items;result=candidate;dirty=false;renderInputs();renderResult();$('inputStatus').className='notice good';$('inputStatus').textContent='已恢复方案及分车记录。';toast('方案已打开。');}catch(e){toast('无法打开：'+e.message);}finally{$('file').value='';}};
renderInputs();calculate();

