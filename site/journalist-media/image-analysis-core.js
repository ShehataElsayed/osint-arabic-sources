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
