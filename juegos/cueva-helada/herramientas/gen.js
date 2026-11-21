const {solve}=require('./engine.js');
let seed=+process.argv[2]||1;function rnd(){seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;}
function gen(w,h,wallP,gems,snow,crack){
  const g=[];for(let y=0;y<h;y++){g.push([]);for(let x=0;x<w;x++){g[y].push((x==0||y==0||x==w-1||y==h-1)?'#':(rnd()<wallP?'#':'.'));}}
  const free=()=>{for(let t=0;t<500;t++){const x=1+Math.floor(rnd()*(w-2)),y=1+Math.floor(rnd()*(h-2));if(g[y][x]==='.')return [x,y];}return null;};
  const put=c=>{const p=free();if(p)g[p[1]][p[0]]=c;};
  put('P');put('E');for(let i=0;i<gems;i++)put('*');for(let i=0;i<snow;i++)put('_');for(let i=0;i<crack;i++)put('x');
  return g.map(r=>r.join(''));
}
const [w,h,wallP,gems,snow,crack,minLen,tries]=process.argv.slice(3).map(Number);
const res=[];
for(let t=0;t<tries;t++){const rows=gen(w,h,wallP,gems,snow,crack);if(!rows.join('').includes('P'))continue;
  const r=solve(rows,150000);if(r.sol&&r.sol.length>=minLen)res.push({len:r.sol.length,sol:r.sol,rows,states:r.states});}
res.sort((a,b)=>b.len-a.len);
for(const r of res.slice(0,3)){console.log(r.len,r.sol,r.states);console.log(r.rows.join('\n'));console.log();}
