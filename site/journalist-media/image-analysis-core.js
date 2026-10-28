// قراءة وصفية محلية لملف الصورة: مؤشرات للمراجعة البشرية، لا أحكام أصالة.
// Pure parsers for JPEG/PNG structure, EXIF, and pixel noise. No network, no DOM.

const ZIGZAG=[0,1,8,16,9,2,3,10,17,24,32,25,18,11,4,5,12,19,26,33,40,48,41,34,27,20,13,6,7,14,21,28,35,42,49,56,57,50,43,36,29,22,15,23,30,37,44,51,58,59,52,45,38,31,39,46,53,60,61,54,47,55,62,63];
const STD_LUMA=[16,11,10,16,24,40,51,61,12,12,14,19,26,58,60,55,14,13,16,24,40,57,69,56,14,17,22,29,51,87,80,62,18,22,37,56,68,109,103,77,24,35,55,64,81,104,113,92,49,64,78,87,103,121,120,101,72,92,95,98,112,100,103,99];

export function scanJpeg(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<4||bytes[0]!==0xFF||bytes[1]!==0xD8)throw Error('الملف ليس JPEG بناء SOI قياسي');
 const markers=[],dqt=[],comments=[];let sof=null,exif=null,i=2,scanData=false;
 while(i<bytes.length-1&&markers.length<200){
  if(bytes[i]!==0xFF){i++;continue}
  let m=bytes[i+1];if(m===0xFF){i++;continue}
  if(m===0x00||m===0x01||(m>=0xD0&&m<=0xD9)){i+=2;continue}
  if(m===0xDA){scanData=true;markers.push({marker:'SOS',offset:i});break}
  if(i+4>bytes.length)break;
  const len=(bytes[i+2]<<8)|bytes[i+3];if(len<2||i+2+len>bytes.length)break;
  const seg=bytes.subarray(i+4,i+2+len),name='0xFF'+m.toString(16).toUpperCase().padStart(2,'0');
  markers.push({marker:name,offset:i,length:len});
  if(m===0xDB){let p=0;while(p<seg.length){const pq=seg[p]>>4,tq=seg[p]&15,n=pq?128:64;if(p+1+n>seg.length)break;const table=[];for(let k=0;k<64;k++)table.push(pq?(seg[p+1+2*k]<<8)|seg[p+2+2*k]:seg[p+1+k]);dqt.push({id:tq,precision:pq?16:8,table});p+=1+n}}
  if(m>=0xC0&&m<=0xCF&&m!==0xC4&&m!==0xC8&&m!==0xCC&&seg.length>=6)sof={precision:seg[0],height:(seg[1]<<8)|seg[2],width:(seg[3]<<8)|seg[4],components:seg[5],coding:name};
  if(m===0xE1&&seg.length>6&&seg[0]===0x45&&seg[1]===0x78&&seg[2]===0x69&&seg[3]===0x66&&seg[4]===0&&seg[5]===0)exif=seg.subarray(6);
  if(m===0xFE&&seg.length)comments.push(new TextDecoder('utf-8',{fatal:false}).decode(seg).slice(0,500));
  i+=2+len}
 return {isJpeg:true,markers,dqt,sof,exif,comments,truncated:scanData?false:true}}

const TYPE_SIZE={1:1,2:1,3:2,4:4,5:8,7:1,9:4,10:8};
function ifdEntries(t,ifdOffset){
 if(ifdOffset<0||ifdOffset+2>t.length)return[];
 const n=t.u16(ifdOffset),out=[];
 for(let k=0;k<n&&k<500;k++){const o=ifdOffset+2+k*12;if(o+12>t.length)break;
  const tag=t.u16(o),type=t.u16(o+2),count=t.u32(o+4),size=(TYPE_SIZE[type]||1)*count,raw=o+8;
  out.push({tag,type,count,size,valueOffset:size<=4?raw:t.u32(raw),inline:size<=4?raw:null})}
 return out}
function readValue(t,e){
 const {type,count}=e;
 const at=o=>type===1||type===7?t.b[e.valueOffset+o]:type===3?t.u16(e.valueOffset+o*2):type===4?t.u32(e.valueOffset+o*4):type===9?t.i32(e.valueOffset+o*4):0;
 if(e.valueOffset<0||e.valueOffset+Math.min(e.size,1024)>t.length)throw Error('قيمة EXIF خارج حدود المقطع');
 if(type===2){const raw=t.b.subarray(e.valueOffset,e.valueOffset+Math.min(count,256));let end=raw.indexOf(0);return new TextDecoder('utf-8',{fatal:false}).decode(raw.subarray(0,end<0?raw.length:end))}
 if(type===5){const vals=[];for(let k=0;k<count&&k<16;k++){const num=t.u32(e.valueOffset+k*8),den=t.u32(e.valueOffset+k*8+4);vals.push(den?num/den:null)}return count===1?vals[0]:vals}
 const vals=[];for(let k=0;k<count&&k<64;k++)vals.push(at(k));return count===1?vals[0]:vals}
function makeTiff(b){
 const le=b[0]===0x49&&b[1]===0x49,be=b[0]===0x4D&&b[1]===0x4D;
 if(!le&&!be)throw Error('ترتيب بايتات TIFF غير معروف');
 const dv=new DataView(b.buffer,b.byteOffset,b.length);
 return {b,u16:o=>dv.getUint16(o,le),u32:o=>dv.getUint32(o,le),i32:o=>dv.getInt32(o,le),length:b.length}}
export function parseExif(tiffBytes){
 if(!(tiffBytes instanceof Uint8Array)||tiffBytes.length<8)throw Error('مقطع EXIF قصير');
 const t=makeTiff(tiffBytes);
 if(t.u16(2)!==42)throw Error('ترويسة TIFF غير صالحة');
 const fields={};let ifd0Offset=t.u32(4),guard=0;
 const named={0x010F:'make',0x0110:'model',0x0131:'software',0x0132:'modified',0x0112:'orientation',0x9003:'captured',0x9004:'digitized',0x829A:'exposureSeconds',0x829D:'fNumber',0x8827:'iso',0xA405:'focalLengthMm',0xA002:'pixelWidth',0xA003:'pixelHeight',0x013B:'artist',0x8298:'copyright'};
 const walk=(offset,label,seen)=>{
  if(seen.has(offset)||guard++>20)return;seen.add(offset);
  for(const e of ifdEntries(t,offset)){
   if(e.tag===0x8769){walk(t.u32(e.valueOffset),'exif',seen);continue}
   if(e.tag===0x8825){fields.gps=parseGps(t,t.u32(e.valueOffset));continue}
   if(e.tag===0xA005){continue}
   const name=named[e.tag];if(!name)continue;
   try{const v=readValue(t,e);if(v!==''&&v!=null&&!(Array.isArray(v)&&!v.length))fields[name]=typeof v==='string'?v.trim():v}catch{}}};
 walk(ifd0Offset,'ifd0',new Set());
 fields.rawTagCount=ifdEntries(t,ifd0Offset).length;
 return fields}
function parseGps(t,offset){
 const out={};
 for(const e of ifdEntries(t,offset)){
  try{
   if(e.tag===1)out.latRef=readValue(t,e);
   if(e.tag===2){const v=readValue(t,e);if(Array.isArray(v)&&v.length===3)out.latDms=v}
   if(e.tag===3)out.lonRef=readValue(t,e);
   if(e.tag===4){const v=readValue(t,e);if(Array.isArray(v)&&v.length===3)out.lonDms=v}
   if(e.tag===5)out.altRef=readValue(t,e);
   if(e.tag===6)out.altitude=readValue(t,e);
   if(e.tag===29)out.date=readValue(t,e)}catch{}}
 if(out.latDms&&out.lonDms&&out.latDms.every(Number.isFinite)&&out.lonDms.every(Number.isFinite)){
  const conv=d=>d[0]+d[1]/60+d[2]/3600;
  let lat=conv(out.latDms),lon=conv(out.lonDms);
  if(/^S/i.test(out.latRef||''))lat=-lat;if(/^W/i.test(out.lonRef||''))lon=-lon;
  if(Math.abs(lat)<=90&&Math.abs(lon)<=180){out.lat=+lat.toFixed(6);out.lon=+lon.toFixed(6)}}
 delete out.latDms;delete out.lonDms;
 return Object.keys(out).length?out:null}
export function estimateQuality(dqt){
 if(!Array.isArray(dqt)||!dqt.length)return null;
 const luma=dqt.find(t=>t.id===0)||dqt[0];if(!luma||luma.table.length!==64)return null;
 let best=null,bestErr=Infinity;
 for(let q=1;q<=100;q++){
  const scale=q<50?5000/q:200-2*q;let err=0;
  for(let k=0;k<64;k++){const want=Math.min(255,Math.max(1,Math.floor((STD_LUMA[k]*scale+50)/100))),got=luma.table[ZIGZAG[k]];err+=Math.abs(want-got)}
  if(err<bestErr){bestErr=err;best=q}}
 return {quality:best,totalError:bestErr,note:'تقدير تقريبي مقابل جدول IJG القياسي؛ مؤشر لا حكم'}}

export function scanPng(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<8||bytes[0]!==0x89||bytes[1]!==0x50)throw Error('الملف ليس PNG قياسي');
 const chunks=[],texts=[];let exif=null,i=8;
 while(i+8<=bytes.length&&chunks.length<200){
  const len=(bytes[i]<<24)|(bytes[i+1]<<16)|(bytes[i+2]<<8)|bytes[i+3];
  const type=String.fromCharCode(bytes[i+4],bytes[i+5],bytes[i+6],bytes[i+7]);
  chunks.push({type,length:len});
  if(len<0||i+12+len>bytes.length)break;
  const data=bytes.subarray(i+8,i+8+len);
  if(type==='eXIf')exif=data;
  if(type==='tEXt'&&len<2000){const s=new TextDecoder('latin1').decode(data),z=s.indexOf('\0');if(z>0)texts.push({key:s.slice(0,z),value:s.slice(z+1).slice(0,300)})}
  i+=12+len;if(type==='IEND')break}
 return {isPng:true,chunks,texts,exif}}

export function noiseMap(rgba,width,height,radius=2,scale=8){
 if(!(rgba instanceof Uint8ClampedArray)||rgba.length!==width*height*4||width<1||height<1||radius<1||radius>10||scale<1||scale>100)throw Error('مدخلات خريطة الضوضاء غير صالحة');
 const out=new Uint8ClampedArray(rgba.length),side=radius*2+1,area=side*side;let sum=0,max=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const idx=(y*width+x)*4;let peak=0;
  for(let c=0;c<3;c++){
   let acc=0,n=0;
   for(let dy=-radius;dy<=radius;dy++){const yy=y+dy;if(yy<0||yy>=height)continue;for(let dx=-radius;dx<=radius;dx++){const xx=x+dx;if(xx<0||xx>=width)continue;acc+=rgba[(yy*width+xx)*4+c];n++}}
   const avg=acc/n,diff=Math.abs(rgba[idx+c]-avg);sum+=diff;if(diff>max)max=diff;if(diff>peak)peak=diff;
   out[idx+c]=Math.min(255,diff*scale)}
  out[idx+3]=255}
 return {output:out,mean:rgba.length?sum/(rgba.length/4*3):0,max,pixels:width*height}}

// استخراج الصورة المصغرة المضمنة في EXIF (IFD1) إن وجدت
export function extractExifThumbnail(tiffBytes){
 try{
  const t=makeTiff(tiffBytes);if(t.u16(2)!==42)return null;
  const ifd0=t.u32(4),n=t.u16(ifd0),next=ifd0+2+n*12;
  const ifd1=t.u32(next);if(!ifd1||ifd1+2>t.length)return null;
  let off=0,len=0,w=null,h=null;
  for(const e of ifdEntries(t,ifd1)){
   if(e.tag===0x0201)off=t.u32(e.valueOffset);
   if(e.tag===0x0202)len=t.u32(e.valueOffset);
   if(e.tag===0x0100)w=readValue(t,e);
   if(e.tag===0x0101)h=readValue(t,e)}
  if(!off||!len||off+len>t.length||len>500000)return null;
  const data=tiffBytes.subarray(off,off+len);
  if(data[0]!==0xFF||data[1]!==0xD8)return null;
  return {data,width:w,height:h}}catch{return null}}

export function luminanceGradient(rgba,width,height,scale=4){
 if(!(rgba instanceof Uint8ClampedArray)||rgba.length!==width*height*4)throw Error('مدخلات التدرج غير صالحة');
 const out=new Uint8ClampedArray(rgba.length);const lum=x=>0.299*rgba[x]+0.587*rgba[x+1]+0.114*rgba[x+2];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4;
  if(x===0||y===0||x===width-1||y===height-1){out[i+3]=255;continue}
  const gx=lum(i+4)-lum(i-4),gy=lum(i+width*4)-lum(i-width*4);
  const g=Math.min(255,Math.hypot(gx,gy)*scale/2);
  out[i]=out[i+1]=out[i+2]=g;out[i+3]=255}
 return {output:out,pixels:width*height}}

export function levelSweep(rgba,level,windowWidth=8){
 if(!(rgba instanceof Uint8ClampedArray)||rgba.length%4||!Number.isFinite(level)||level<0||level>255)throw Error('مدخلات مسح المستويات غير صالحة');
 const out=new Uint8ClampedArray(rgba.length);
 for(let i=0;i<rgba.length;i+=4){
  const l=0.299*rgba[i]+0.587*rgba[i+1]+0.114*rgba[i+2];
  const inside=Math.abs(l-level)<=windowWidth/2;
  out[i]=out[i+1]=out[i+2]=inside?255:0;out[i+3]=255}
 return {output:out,level,windowWidth}}

export function channelHistogram(rgba){
 if(!(rgba instanceof Uint8ClampedArray)||rgba.length%4)throw Error('مدخلات المدرج غير صالحة');
 const r=Array(256).fill(0),g=Array(256).fill(0),b=Array(256).fill(0),l=Array(256).fill(0);
 for(let i=0;i<rgba.length;i+=4){r[rgba[i]]++;g[rgba[i+1]]++;b[rgba[i+2]]++;l[Math.round(0.299*rgba[i]+0.587*rgba[i+1]+0.114*rgba[i+2])]++}
 const max=Math.max(1,...r,...g,...b);
 return {r,g,b,l,max,pixels:rgba.length/4}}

const STRING_HINT=/adobe|photoshop|gimp|lightroom|pixlr|canva|snapseed|xmp|software|creator|canon|nikon|sony|fujifilm|olympus|samsung|huawei|xiaomi|iphone|android|windows|paint/i;
export function extractStrings(bytes,{minLen=8,limit=400,hintOnly=true}={}){
 if(!(bytes instanceof Uint8Array)||!bytes.length)throw Error('لا بايتات للفحص');
 const out=[];let cur=[],start=0;
 const flush=()=>{if(cur.length>=minLen){const s=new TextDecoder('utf-8',{fatal:false}).decode(new Uint8Array(cur));if(!hintOnly||STRING_HINT.test(s))out.push({offset:start,text:s.slice(0,300)})}cur=[]};
 const cap=Math.min(bytes.length,3*1024*1024);
 for(let i=0;i<cap&&out.length<limit;i++){const b=bytes[i];
  if(b>=32&&b<127){if(!cur.length)start=i;cur.push(b)}else flush()}
 flush();
 const seen=new Set(),dedup=[];
 for(const s of out){const k=s.text.slice(0,120);if(seen.has(k))continue;seen.add(k);dedup.push(s)}
 return dedup.slice(0,60)}

// كشف نسخ-لصق مناطق داخل الصورة (مطابقة كتل بمعاملات DCT مكمّمة، أسلوب Fridrich وآخرين المنشور)
const COS=[];for(let u=0;u<4;u++){COS[u]=[];for(let x=0;x<16;x++)COS[u][x]=Math.cos((2*x+1)*u*Math.PI/32)}
function dctFeatures(gray,w,x0,y0,B,Q){
 // معاملات DCT منخفقة التردد (u,v في 0..2) لكتلة B×B، مكمّمة بخطوة Q
 const F=[];const cu=u=>u===0?Math.SQRT1_2:1;
 for(let v=0;v<4;v++)for(let u=0;u<4;u++){
  let sum=0;
  for(let y=0;y<B;y++){const gy=gray[y0+y];for(let x=0;x<B;x++)sum+=gy[x0+x]*COS[u][x]*COS[v][y]}
  F.push(Math.round(sum*cu(u)*cu(v)/128/Q))}
 return F}
export function detectClones(rgba,width,height,{block=16,stride=2,quant=6,tol=1,win=64,binShift=4,margin=1,minShift=24,minCount=60,maxGroups=6}={}){
 if(!(rgba instanceof Uint8ClampedArray)||rgba.length!==width*height*4)throw Error('مدخلات كشف النسخ غير صالحة');
 if(width<48||height<48)return {groups:[],blocks:0,note:'الصورة أصغر من الحد الأدنى للفحص (48 بكسل)'};
 const gray=[];for(let y=0;y<height;y++){const row=new Float32Array(width);for(let x=0;x<width;x++){const i=(y*width+x)*4;row[x]=0.299*rgba[i]+0.587*rgba[i+1]+0.114*rgba[i+2]-128}gray.push(row)}
 const recs=[];
 for(let y=0;y+block<=height;y+=stride)for(let x=0;x+block<=width;x+=stride){
  let mean=0;const row0=gray[y];for(let yy=0;yy<block;yy++)for(let xx=0;xx<block;xx++)mean+=gray[y+yy][x+xx];mean/=block*block;
  let sd=0;for(let yy=0;yy<block;yy+=2)for(let xx=0;xx<block;xx+=2){const d=gray[y+yy][x+xx]-mean;sd+=d*d}sd=Math.sqrt(sd/(block*block/4));
  if(sd<4)continue;
  recs.push({x,y,f:dctFeatures(gray,width,x,y,block,quant)})}
 recs.sort((a,b)=>{const A=a.f,B=b.f;for(let i=0;i<A.length;i++){if(A[i]!==B[i])return A[i]-B[i]}return a.y-b.y||a.x-b.x});
 const shifts=new Map(),runPairs=[];
 // مطابقة متساهلة: بعد الترتيب الأبجدي، تُقبل الكتل المتجاورة ضمن نافذة إذا كان كل معامل ضمن حد التسامح؛
 // كثافة التطابقات فوق maxSim تعني قوامًا دوريًا (نوافذ، بلاط) فتُستبعد بدل إغراق النتائج
 // لكل كتلة يُحسب أقرب تطابق واحد فقط ضمن التسامح؛ النسخ الحقيقي يجمع كتلًا كثيرة عند نفس الإزاحة،
 // بينما يتفرق القوام الدوري على إزاحات قصيرة أو متباعدة لا تتجاوز العتبات
 for(let i=0;i<recs.length-1;i++){
  const A=recs[i].f;let best=-1,bestD=Infinity,secondD=Infinity,checked=0;
  for(let j=i+1;j<recs.length;j++){
   if(recs[j].f[0]-A[0]>tol)break;
   if(++checked>win)break;
   let mx=0;for(let k=1;k<A.length;k++){const d=Math.abs(recs[j].f[k]-A[k]);if(d>mx)mx=d;if(mx>tol)break}
   if(mx>tol)continue;
   if(mx<bestD){secondD=bestD;bestD=mx;best=j}else if(mx<secondD)secondD=mx}
  // التطابق الدوري (قوام متكرر) يكون فيه الأفضل والثاني بنفس الجودة فيُستبعد؛ النسخ الحقيقي أفضل بفارق واضح
  if(best<0||secondD-bestD<margin)continue;
  const dx=recs[best].x-recs[i].x,dy=recs[best].y-recs[i].y;
  if(Math.hypot(dx,dy)<minShift)continue;
  // تجميع الإزاحات القريبة في سلة واحدة: ضجيج إعادة الضغط يبدد الإزاحة الدقيقة
  const bdx=Math.round(dx/binShift)*binShift,bdy=Math.round(dy/binShift)*binShift;
  const key=bdx+','+bdy;shifts.set(key,(shifts.get(key)||0)+1);
  runPairs.push({ax:recs[i].x,ay:recs[i].y,bx:recs[best].x,by:recs[best].y,dx:bdx,dy:bdy})}
 const groups=[...shifts.entries()].filter(([,c])=>c>=minCount).sort((a,b)=>b[1]-a[1]).slice(0,maxGroups)
  .map(([k,count])=>{const[dx,dy]=k.split(',').map(Number);
   const pairs=runPairs.filter(p=>p.dx===dx&&p.dy===dy).slice(0,400);
   let x0=1e9,y0=1e9,x1=-1,y1=-1;for(const p of pairs){x0=Math.min(x0,p.ax);y0=Math.min(y0,p.ay);x1=Math.max(x1,p.ax);y1=Math.max(y1,p.ay)}
   // النسخ الحقيقي يتجمع في منطقة محدودة؛ الانتشار الدوري على كامل الصورة يُستبعد
   const bboxArea=(x1-x0+block)*(y1-y0+block),spread=bboxArea/(width*height);
   return {dx,dy,count,pairs,spread:+spread.toFixed(3),periodic:spread>0.45}})
  .filter(g=>!g.periodic);
 return {groups,blocks:recs.length,note:groups.length?'':'لم تُرصد مناطق مكررة بنفس الإزاحة فوق العتبات'}}

// PCA over RGB: projections onto principal components, normalized for review.
// Like every layer here it is a review indicator only; it cannot classify authenticity.
export function pcaProjections(rgba,width,height){
 if(!(rgba instanceof Uint8ClampedArray)||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||rgba.length!==width*height*4)throw Error('مدخلات تحليل المكونات غير صالحة');
 const n=width*height;let mr=0,mg=0,mb=0;
 for(let i=0;i<rgba.length;i+=4){mr+=rgba[i];mg+=rgba[i+1];mb+=rgba[i+2]}
 mr/=n;mg/=n;mb/=n;
 let c00=0,c01=0,c02=0,c11=0,c12=0,c22=0;
 for(let i=0;i<rgba.length;i+=4){const r=rgba[i]-mr,g=rgba[i+1]-mg,b=rgba[i+2]-mb;c00+=r*r;c01+=r*g;c02+=r*b;c11+=g*g;c12+=g*b;c22+=b*b}
 const inv=1/n;c00*=inv;c01*=inv;c02*=inv;c11*=inv;c12*=inv;c22*=inv;
 // Jacobi eigendecomposition of the symmetric 3x3 covariance
 let a=[[c00,c01,c02],[c01,c11,c12],[c02,c12,c22]],v=[[1,0,0],[0,1,0],[0,0,1]];
 for(let sweep=0;sweep<12;sweep++){let off=0;
  for(const[p,q]of[[0,1],[0,2],[1,2]]){off+=Math.abs(a[p][q]);
   if(Math.abs(a[p][q])>1e-12){const theta=(a[q][q]-a[p][p])/(2*a[p][q]),t=Math.sign(theta||1)/(Math.abs(theta)+Math.sqrt(theta*theta+1)),c=1/Math.sqrt(t*t+1),sn=t*c;
    for(let k=0;k<3;k++){const akp=a[k][p],akq=a[k][q];a[k][p]=c*akp-sn*akq;a[k][q]=sn*akp+c*akq}
    for(let k=0;k<3;k++){const apk=a[p][k],aqk=a[q][k];a[p][k]=c*apk-sn*aqk;a[q][k]=sn*apk+c*aqk}
    for(let k=0;k<3;k++){const vkp=v[k][p],vkq=v[k][q];v[k][p]=c*vkp-sn*vkq;v[k][q]=sn*vkp+c*vkq}}}
  if(off<1e-10)break}
 const order=[0,1,2].sort((x,y)=>a[y][y]-a[x][x]);
 const vectors=order.map(k=>[v[0][k],v[1][k],v[2][k]]),variances=order.map(k=>Math.max(0,a[k][k]));
 const mins=[1/0,1/0,1/0],maxs=[-1/0,-1/0,-1/0],raw=[new Float32Array(n),new Float32Array(n),new Float32Array(n)];
 for(let p=0,i=0;p<n;p++,i+=4){const r=rgba[i]-mr,g=rgba[i+1]-mg,b=rgba[i+2]-mb;
  for(let k=0;k<3;k++){const val=r*vectors[k][0]+g*vectors[k][1]+b*vectors[k][2];raw[k][p]=val;if(val<mins[k])mins[k]=val;if(val>maxs[k])maxs[k]=val}}
 const components=raw.map((arr,k)=>{const out=new Uint8ClampedArray(arr.length),span=maxs[k]-mins[k];
  if(span>1e-9)for(let p=0;p<arr.length;p++)out[p]=Math.round((arr[p]-mins[k])/span*255);
  return out});
 return {components,variances:variances.map(x=>+x.toFixed(2)),vectors:vectors.map(vec=>vec.map(x=>+x.toFixed(4)))};
}


// بصمات إدراكية لمطابقة النسخ المتشابهة من الصورة يدويًا: aHash (متوسط 8×8) وdHash (تدرج 9×8).
// مؤشر مقارنة بين نسختين يحسبه المستخدم بنفسه؛ لا يثبت أصالة ولا تطابقًا قاطعًا.
export function perceptualHashes(rgba,width,height){
 if(!(rgba instanceof Uint8ClampedArray)||rgba.length!==width*height*4||width<1||height<1)throw Error('مدخلات البصمة الإدراكية غير صالحة');
 const acc=(gw,gh)=>{const g=new Float64Array(gw*gh),c=new Float64Array(gw*gh);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const i=(y*width+x)*4,v=0.299*rgba[i]+0.587*rgba[i+1]+0.114*rgba[i+2];
   const cx=Math.min(gw-1,(x*gw/width)|0),cy=Math.min(gh-1,(y*gh/height)|0),k=cy*gw+cx;g[k]+=v;c[k]++}
  for(let k=0;k<g.length;k++)g[k]/=Math.max(1,c[k]);return g};
 const g8=acc(8,8);let mean=0;for(const v of g8)mean+=v;mean/=64;
 let ah=0n;for(let k=0;k<64;k++){ah<<=1n;if(g8[k]>=mean)ah|=1n}
 const g9=acc(9,8);let dh=0n;for(let y=0;y<8;y++)for(let x=0;x<8;x++){dh<<=1n;if(g9[y*9+x]>g9[y*9+x+1])dh|=1n}
 const h=b=>b.toString(16).padStart(16,'0');
 return {ahash:h(ah),dhash:h(dh)}}

// Magnifier enhancements on a copied RGBA region: histogram equalization or per-channel auto contrast.
export function enhanceRegion(rgba,{mode='none'}={}){
 if(!(rgba instanceof Uint8ClampedArray)||rgba.length%4)throw Error('مدخلات التحسين غير صالحة');
 if(mode==='none')return rgba;
 if(mode==='auto-contrast'){
  for(let c=0;c<3;c++){let lo=255,hi=0;
   for(let i=c;i<rgba.length;i+=4){const val=rgba[i];if(val<lo)lo=val;if(val>hi)hi=val}
   if(hi>lo)for(let i=c;i<rgba.length;i+=4)rgba[i]=Math.round((rgba[i]-lo)/(hi-lo)*255)}
  return rgba}
 if(mode==='equalize'){
  const hist=new Array(256).fill(0),lum=new Uint8ClampedArray(rgba.length/4);
  for(let p=0,i=0;p<lum.length;p++,i+=4){const l=Math.round(0.2126*rgba[i]+0.7152*rgba[i+1]+0.0722*rgba[i+2]);lum[p]=l;hist[l]++}
  const cdf=new Array(256);let acc=0;for(let i=0;i<256;i++){acc+=hist[i];cdf[i]=acc}
  const total=lum.length||1,map=cdf.map(c=>Math.min(255,Math.round(c/total*255)));
  for(let p=0,i=0;p<lum.length;p++,i+=4){const l=lum[p];if(l<1)continue;const s=map[l]/l;
   for(let c=0;c<3;c++)rgba[i+c]=Math.min(255,Math.round(rgba[i+c]*s))}
  return rgba}
 throw Error('نمط تحسين غير معروف')}
