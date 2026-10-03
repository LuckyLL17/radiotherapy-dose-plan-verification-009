import {checkPass,structures} from './dist/index.js';
let failures=0;
const assert=(name,actual,expected)=>{
  const ok=actual===expected;
  if(!ok)failures++;
  console.log(`${ok?'PASS':'FAIL'}  ${name}: got ${actual}, want ${expected}`);
};
const byId=id=>structures.find(s=>s.id===id);
// 靶区 D95：低于 95 失败；刚好 95 通过；高于 95 通过
const ptv=byId('PTV');
assert('PTV D95 = 93.4 (PLAN-B 场景) -> FAIL',checkPass(ptv,93.4),false);
assert('PTV D95 = 94.99 -> FAIL',checkPass(ptv,94.99),false);
assert('PTV D95 = 95.00 (临界) -> PASS',checkPass(ptv,95),true);
assert('PTV D95 = 95.01 -> PASS',checkPass(ptv,95.01),true);
assert('PTV D95 = 96.4 (PLAN-A 场景) -> PASS',checkPass(ptv,96.4),true);
// 危及器官：不超过限值通过（含等于），超过限值失败
assert('LUNG V20 = 25.00 (临界) -> PASS',checkPass(byId('LUNG'),25),true);
assert('LUNG V20 = 25.01 -> FAIL',checkPass(byId('LUNG'),25.01),false);
assert('LUNG V20 = 24.3 (PLAN-B) -> PASS',checkPass(byId('LUNG'),24.3),true);
assert('HEART V20 = 15.00 (临界) -> PASS',checkPass(byId('HEART'),15),true);
assert('HEART V20 = 15.01 -> FAIL',checkPass(byId('HEART'),15.01),false);
assert('HEART V20 = 12.3 (PLAN-B) -> PASS',checkPass(byId('HEART'),12.3),true);
assert('CORD Dmax = 45.00 (临界) -> PASS',checkPass(byId('CORD'),45),true);
assert('CORD Dmax = 45.01 -> FAIL',checkPass(byId('CORD'),45.01),false);
assert('CORD Dmax = 45.4 (PLAN-B) -> FAIL',checkPass(byId('CORD'),45.4),false);
assert('CORD Dmax = 42.1 (PLAN-A) -> PASS',checkPass(byId('CORD'),42.1),true);
assert('ESOPH Dmax = 50.00 (临界) -> PASS',checkPass(byId('ESOPH'),50),true);
assert('ESOPH Dmax = 50.01 -> FAIL',checkPass(byId('ESOPH'),50.01),false);
assert('ESOPH Dmax = 49.8 (PLAN-B) -> PASS',checkPass(byId('ESOPH'),49.8),true);
assert('ESOPH Dmax = 46.8 (PLAN-A) -> PASS',checkPass(byId('ESOPH'),46.8),true);
if(failures){console.error(`\n${failures} assertion(s) failed`);process.exit(1);}
console.log('\nAll boundary assertions passed.');
