const BASE='http://127.0.0.1:6202';
let failures=0;
const get=p=>fetch(BASE+p).then(r=>r.json());
const post=(p,b)=>fetch(BASE+p,{method:'POST',...(b?{headers:{'content-type':'application/json'},body:JSON.stringify(b)}:{})}).then(r=>r.json());
const check=(name,cond,extra='')=>{console.log(`${cond?'PASS':'FAIL'}  ${name}${extra?'  '+extra:''}`);if(!cond)failures++;};

// 0) 历史数据：先制造一条历史记录（同行复核 + 一条 QA），修复后验证未被清除
await post('/api/plans/PLAN-A/peer-review',{reviewer:'张物理',note:'修复前基线复核记录'});
await post('/api/plans/PLAN-A/independent-check',{method:'gamma',score:97.5});
const auditBefore=await get('/api/audit');
const dossierBefore=await get('/api/plans/PLAN-A/verification-dossier');
check('历史数据已建立：审计 2 条',auditBefore.length>=2,`audit=${auditBefore.length}`);
check('历史 QA 未被清除（共 3 条）',dossierBefore.qa.length===3,`qa=${dossierBefore.qa.length}`);

// 1) PLAN-A
const ca=await get('/api/plans/PLAN-A/constraints');
const ptvA=ca.checks.find(x=>x.structureId==='PTV');
check('PLAN-A PTV D95=96.4 -> PASS',ptvA.pass===true&&ptvA.value===96.4,JSON.stringify(ptvA));
check('PLAN-A 约束门禁 ready',ca.gate==='ready',`gate=${ca.gate}`);
check('PLAN-A 全部 5 项 PASS',ca.checks.every(x=>x.pass),ca.checks.map(x=>`${x.name}:${x.pass}`).join(' '));

// 2) PLAN-B
const cb=await get('/api/plans/PLAN-B/constraints');
const ptvB=cb.checks.find(x=>x.structureId==='PTV');
check('PLAN-B PTV D95=93.4 -> FAIL（核心缺陷）',ptvB.pass===false&&ptvB.value===93.4,JSON.stringify(ptvB));
check('PLAN-B 肺 V20=24.3 -> PASS',cb.checks.find(x=>x.structureId==='LUNG').pass===true);
check('PLAN-B 心脏 V20=12.3 -> PASS',cb.checks.find(x=>x.structureId==='HEART').pass===true);
check('PLAN-B 脊髓 Dmax=45.4 -> FAIL（超限器官仍按 <= 规则）',cb.checks.find(x=>x.structureId==='CORD').pass===false);
check('PLAN-B 食管 Dmax=49.8 -> PASS',cb.checks.find(x=>x.structureId==='ESOPH').pass===true);
check('PLAN-B 约束门禁 blocked',cb.gate==='blocked',`gate=${cb.gate}`);

// 3) 三处结论一致性：约束接口 vs 对比接口 vs 签发 dossier
const cmp=await get('/api/compare');
for(const id of ['PLAN-A','PLAN-B']){
  const cons=await get(`/api/plans/${id}/constraints`);
  const cp=cmp.plans.find(p=>p.id===id);
  const dossier=await get(`/api/plans/${id}/verification-dossier`);
  const samePass=cons.checks.every(c=>{
    const inCompare=cp.checks.find(x=>x.structureId===c.structureId).pass;
    const inDossier=dossier.checks.find(x=>x.structureId===c.structureId).pass;
    return inCompare===c.pass&&inDossier===c.pass;
  });
  const failCount=cons.checks.filter(x=>!x.pass).length;
  check(`${id} 三处 PASS/FAIL 逐项一致`,samePass);
  check(`${id} 对比页失败数=${failCount} 与约束接口一致`,cp.checks.filter(x=>!x.pass).length===failCount);
  check(`${id} dossier check 与约束接口一致`,dossier.checks.every(c=>cons.checks.find(x=>x.structureId===c.structureId).pass===c.pass));
}
check('PLAN-B release 门禁因 PTV 约束失败而 blocked',(await get('/api/plans/PLAN-B/verification-dossier')).blockers.some(b=>b.includes('PTV')));
check('PLAN-A 约束接口自身 ready（对比/签发结论以此为准）',(await get('/api/plans/PLAN-A/constraints')).gate==='ready');
check('对比页 PLAN-B 失败数=2（PTV+脊髓）',cmp.plans.find(p=>p.id==='PLAN-B').checks.filter(x=>!x.pass).length===2);
check('对比页 PLAN-A 失败数=0',cmp.plans.find(p=>p.id==='PLAN-A').checks.filter(x=>!x.pass).length===0);

// 4) 签发阻断：PLAN-B 必须被 approve 与 release 双双阻断，且状态不得改变
const plansBefore=(await get('/api/plans')).find(p=>p.id==='PLAN-B').status;
const ab=await post('/api/plans/PLAN-B/approve');
check('PLAN-B /approve 被阻断',ab.approved===false&&ab.gate==='blocked',`failed=${(ab.failed??[]).map(x=>x.name).join('、')}`);
check('PLAN-B 失败清单包含 PTV',(ab.failed??[]).some(x=>x.structureId==='PTV'));
const plansMid=(await get('/api/plans')).find(p=>p.id==='PLAN-B').status;
check('PLAN-B 阻断后状态未变（仍 draft）',plansMid==='draft'&&plansMid===plansBefore,`status=${plansMid}`);
const rb=await post('/api/plans/PLAN-B/release');
check('PLAN-B /release 被阻断',rb.released===false&&rb.gate==='blocked',`blockers=${(rb.blockers??[]).join('；')}`);
check('PLAN-B release blockers 含 PTV 约束失败',(rb.blockers??[]).some(x=>x.includes('PTV')));
const plansAfter=(await get('/api/plans')).find(p=>p.id==='PLAN-B').status;
check('PLAN-B release 阻断后状态仍 draft',plansAfter==='draft');

// 5) PLAN-A 可正常签发
const aa=await post('/api/plans/PLAN-A/approve');
check('PLAN-A /approve 成功',aa.approved===true,`status=${aa.plan?.status}`);

// 6) 历史数据未被清除
const auditAfter=await get('/api/audit');
const dossierAfter=await get('/api/plans/PLAN-A/verification-dossier');
check('历史审计记录保留（仅增加不减少）',auditAfter.length>=auditBefore.length,`before=${auditBefore.length}, after=${auditAfter.length}`);
check('基线同行复核记录仍在',auditAfter.some(a=>a.action==='peer_review'&&a.reviewer==='张物理'));
check('历史 QA 记录仍在（含修复前 QA-071/072 + gamma 97.5）',dossierAfter.qa.length===3&&dossierAfter.qa.some(q=>q.score===97.5),`qa=${dossierAfter.qa.length}`);

if(failures){console.error(`\n${failures} check(s) failed`);process.exit(1);}
console.log('\nAll end-to-end checks passed.');
