// Motor del juego: deslizarse sobre hielo
const DIRS={U:[0,-1],D:[0,1],L:[-1,0],R:[1,0]};
function parse(rows){
  const h=rows.length,w=rows[0].length;let px,py,ex,ey;const gems=[];const grid=[];
  for(let y=0;y<h;y++){grid.push([]);for(let x=0;x<w;x++){let c=rows[y][x];
    if(c==='P'){px=x;py=y;c='.';} if(c==='Q'){px=x;py=y;c='x';}
    if(c==='E'){ex=x;ey=y;} if(c==='*'){gems.push([x,y]);}
    grid[y].push(c);}}
  return {w,h,grid,px,py,ex,ey,gems};
}
// estado: {x,y,got:bitmask,cracked:Set as string of water positions}
function step(L,s,dir){
  const [dx,dy]=DIRS[dir];let {x,y}=s;let got=s.got;const water=new Set(s.water);
  const path=[[x,y]];let result='stop';const total=L.gems.length;
  const tileAt=(X,Y)=>{if(X<0||Y<0||X>=L.w||Y>=L.h)return '#';if(water.has(X+','+Y))return '~';return L.grid[Y][X];};
  let moved=false;
  while(true){
    const nx=x+dx,ny=y+dy;const t=tileAt(nx,ny);
    if(t==='#'||t==='B')break;
    // salir de hielo frágil
    if(L.grid[y][x]==='x')water.add(x+','+y);
    x=nx;y=ny;moved=true;path.push([x,y]);
    if(t==='~'){result='fall';break;}
    if(t==='*'){const i=L.gems.findIndex(g=>g[0]===x&&g[1]===y);got|=1<<i;}
    if(t==='_')break;
    if(t==='E'&&got===(1<<total)-1){result='win';break;}
  }
  if(!moved)return null;
  return {x,y,got,water:[...water].sort(),path,result};
}
function key(s){return s.x+','+s.y+'|'+s.got+'|'+s.water.join(';');}
function solve(rows,maxStates=400000){
  const L=parse(rows);const start={x:L.px,y:L.py,got:0,water:[]};
  const q=[[start,'']];const seen=new Set([key(start)]);let i=0;
  while(i<q.length){const [s,p]=q[i++];if(seen.size>maxStates)return {sol:null,overflow:true};
    for(const d of 'UDLR'){const n=step(L,s,d);if(!n)continue;if(n.result==='fall')continue;
      if(n.result==='win')return {sol:p+d,states:seen.size};
      const k=key(n);if(seen.has(k))continue;seen.add(k);q.push([n,p+d]);}}
  return {sol:null,states:seen.size};
}
if(typeof module!=='undefined')module.exports={parse,step,solve,DIRS};
