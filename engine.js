'use strict';
const Engine = (() => {
  const demo = [
    ['PF-01',3650,3500,150,5.21],['PF-02',2335,3500,150,2.75],
    ['PF-03-A',1500,3405,150,1.22],['PF-03-B',1500,3500,150,1.80],
    ['PF-04',3225,3500,150,4.00],['PF-05',2095,3500,150,2.65],
    ['PF-06',5075,3500,150,7.25],['PF-07',2600,3500,150,3.02],
    ['PF-08',2300,3500,150,3.29]
  ].map(([name,l,h,t,w],i)=>({id:'p'+i,name,l,h,t,w,q:1}));
  const defaults={length:12000,deck:900,width:2500,limitH:4600,limitW:20,angle:10,autoAngle:1,aisle:250,rebar:300,rowGap:0,edge:0,rackW:null,rackL:null,core:null,support:null,rackWeight:null};
  const optional=['rackW','rackL','core','support','rackWeight'];
  function validate(c, items) {
    for (const k of Object.keys(defaults)) {
      if(optional.includes(k)&&c[k]===null) continue;
      if(typeof c[k]!=='number'||!Number.isFinite(c[k])||c[k]<0) throw Error('车辆／运输架参数必须为有效非负数字：'+k);
    }
    if(![9000,12000].includes(c.length)||![900,1200].includes(c.deck))throw Error('请选择9／12米车长和0.9／1.2米车架。');
    if(![2400,2500].includes(c.width)||c.limitH!==4600||c.limitW!==20)throw Error('可用宽度选择2400／2500 mm；上限固定为4600 mm、20 t。');
    if(![0,1].includes(c.autoAngle))throw Error('请选择固定倾角或四件优先估算。');
    if(c.angle>10)throw Error('试排倾角范围为0–10°；更大倾角不在本次约定范围内。');
    if(c.aisle>=c.width||2*c.edge>=c.width)throw Error('通道或车边余量超过车宽。');
    if(!Array.isArray(items)||!items.length)throw Error('请至少填写一行构件。');
    let count=0;
    for(const p of items){
      if(typeof p.name!=='string'||!p.name.trim())throw Error('构件编号不能为空。');
      for(const k of ['l','h','t','w'])if(!Number.isFinite(p[k])||p[k]<=0)throw Error(p.name+'：尺寸及重量必须大于零。');
      if(!Number.isInteger(p.q)||p.q<1||p.q>100)throw Error(p.name+'：数量须为1–100的整数。');
      count+=p.q;
    }
    if(count>100)throw Error('原型每次最多试排100件构件。');
  }
  function expand(items){return items.flatMap((p,i)=>Array.from({length:p.q},(_,j)=>({...p,id:`${i}:${j}`,name:p.q>1?`${p.name} · ${j+1}`:p.name,q:1})));}
  function geom(p,c){const a=c.angle*Math.PI/180;return {length:p.l+2*c.rebar,width:p.h*Math.sin(a)+p.t*Math.cos(a),height:p.h*Math.cos(a)+p.t*Math.sin(a)+c.deck+(c.support??0)};}
  function rack(ps,c){return {ps,width:Math.max(c.rackW??0,ps.reduce((s,p)=>s+geom(p,c).width,0)+(c.core??0)),length:Math.max(c.rackL??0,...ps.map(p=>geom(p,c).length)),weight:ps.reduce((s,p)=>s+p.w,0)+(c.rackWeight??0)};}
  function rowOptions(ps,c){
    if(!ps.length||ps.length>4)return [];
    let opts=[];
    // Every partition into one/two racks, each with at most two walls.
    for(let mask=1;mask<(1<<ps.length);mask++){
      if(!(mask&1))continue;
      const a=ps.filter((_,i)=>mask&(1<<i)),b=ps.filter((_,i)=>!(mask&(1<<i)));
      if(a.length>2||b.length>2)continue;
      const racks=[rack(a,c),...(b.length?[rack(b,c)]:[])];
      const width=racks.reduce((s,r)=>s+r.width,0)+(racks.length===2?c.aisle:0)+2*c.edge;
      opts.push({ps,racks,width,length:Math.max(...racks.map(r=>r.length)),weight:racks.reduce((s,r)=>s+r.weight,0)});
    }
    return opts.sort((a,b)=>a.racks.length-b.racks.length||a.width-b.width);
  }
  function bestRow(ps,c){return rowOptions(ps,c).find(r=>r.width<=c.width+1e-7&&r.length<=c.length+1e-7);}
  function fitAngle(c,items){
    if(!c.autoAngle)return {...c};
    const ps=expand(items).sort((a,b)=>geom(b,{...c,angle:10}).width-geom(a,{...c,angle:10}).width).slice(0,4);
    // Find the largest tenth of a degree that admits the widest four walls.
    // This is a trial geometry, never a measurement of the actual rack angle.
    for(let tenth=100;tenth>=0;tenth--){const trial={...c,angle:tenth/10};if(rowOptions(ps,trial).some(r=>r.width<=c.width+1e-7))return trial;}
    return {...c,angle:0};
  }
  function metrics(rows,c){return {length:rows.reduce((s,r)=>s+r.length,0)+Math.max(0,rows.length-1)*c.rowGap,weight:rows.reduce((s,r)=>s+r.weight,0),racks:rows.reduce((s,r)=>s+r.racks.length,0)};}
  function fits(rows,c){const m=metrics(rows,c);return m.length<=c.length+1e-7&&m.weight<=c.limitW+1e-7;}
  function pack(order,c){
    const trucks=[];
    for(const p of order){
      let candidates=[];
      for(let ti=0;ti<trucks.length;ti++){
        const rows=trucks[ti];
        for(let ri=0;ri<=rows.length;ri++){
          const nr=bestRow(ri===rows.length?[p]:[...rows[ri].ps,p],c);if(!nr)continue;
          const next=rows.slice();next[ri]=nr;if(!fits(next,c))continue;
          const before=metrics(rows,c),after=metrics(next,c);
          candidates.push({ti,next,score:(after.length-before.length)+100*(after.racks-before.racks)});
        }
      }
      candidates.sort((a,b)=>a.score-b.score||a.ti-b.ti);
      if(candidates.length)trucks[candidates[0].ti]=candidates[0].next;
      else trucks.push([bestRow([p],c)]);
    }
    return trucks;
  }
  function score(trucks,c){const weights=trucks.map(rs=>metrics(rs,c).weight),rows=trucks.flat();return trucks.length*1e12+rows.length*1e8-rows.filter(r=>r.ps.length===4).length*1e6+trucks.reduce((s,rs)=>s+metrics(rs,c).length,0)*10+(weights.length?Math.max(...weights)-Math.min(...weights):0);}
  function solve(c,items){
    validate(c,items);c=fitAngle(c,items);const all=expand(items),rejected=[],valid=[];
    for(const p of all){
      const g=geom(p,c),reasons=[];
      if(g.height>c.limitH+1e-7)reasons.push(`总高至少${Math.ceil(g.height)} mm，超过4600 mm`);
      if(Math.max(g.length,c.rackL??0)>c.length)reasons.push('包含出筋／架体的长度超过车长');
      if(p.w+(c.rackWeight??0)>c.limitW)reasons.push('单件加一架已超过20 t');
      if(!bestRow([p],c)&&!reasons.length)reasons.push('单件加架的横向空间超过可用车宽');
      if(reasons.length)rejected.push({p,reasons});else valid.push(p);
    }
    const orders=[valid.slice().sort((a,b)=>b.l-a.l),valid.slice().sort((a,b)=>b.w-a.w),valid.slice().sort((a,b)=>a.l-b.l)];
    let seed=719;
    for(let k=0;k<(valid.length<=20?100:15);k++){
      let o=valid.slice();for(let i=o.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[o[i],o[j]]=[o[j],o[i]];}orders.push(o);
    }
    let trucks=[];let best=Infinity;
    for(const order of orders){const t=pack(order,c),s=score(t,c);if(s<best){best=s;trucks=t;}}
    return {trucks,rejected,all,pending:optional.filter(k=>c[k]===null),manual:false,config:c};
  }
  function repackManual(ps,c){
    let rows=[];
    for(const p of ps.slice().sort((a,b)=>b.l-a.l)){
      let ix=-1,nr=null,best=Infinity;
      rows.forEach((r,i)=>{const candidate=bestRow([...r.ps,p],c);if(candidate&&candidate.length-r.length<best){ix=i;nr=candidate;best=candidate.length-r.length;}});
      if(ix<0) rows.push(bestRow([p],c)||rowOptions([p],c)[0]);else rows[ix]=nr;
    }
    return rows;
  }
  return {demo,defaults,optional,validate,expand,geom,rack,rowOptions,bestRow,metrics,solve,repackManual,fitAngle};
})();
if(typeof module!=='undefined')module.exports=Engine;

