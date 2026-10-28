export function sampleTimes(duration,count){if(!Number.isFinite(duration)||duration<=0||duration>1200)throw Error('مدة غير مدعومة');if(!Number.isInteger(count)||count<2||count>12)throw Error('عدد اللقطات بين2و12');const end=Math.max(0,duration-Math.min(.1,duration/100));return Array.from({length:count},(_,i)=>i*end/(count-1))}
export function stamp(seconds){if(!Number.isFinite(seconds)||seconds<0)throw Error('موضع غير صالح');const ms=Math.round(seconds*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`}
export function outputSize(width,height){if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1||width*height>8000000)throw Error('الفيديو يتجاوز8ملايين بكسل أو أبعاده غير صالحة');const ratio=Math.min(1,1280/Math.max(width,height));return [Math.max(1,Math.round(width*ratio)),Math.max(1,Math.round(height*ratio))]}

// مواضع العينات المرشحة لكشف تغيّر المشهد: كثافة أعلى للمقاطع القصيرة بحد أقصى يضبط زمن الانتقالات
export function candidateTimes(duration,maxCandidates=48){if(!Number.isFinite(duration)||duration<=0||duration>1200)throw Error('مدة غير مدعومة');if(!Number.isInteger(maxCandidates)||maxCandidates<8||maxCandidates>200)throw Error('عدد العينات بين8و200');const count=Math.min(maxCandidates,Math.max(8,Math.ceil(duration*2)));const end=Math.max(0,duration-Math.min(.1,duration/100));return Array.from({length:count},(_,i)=>i*end/(count-1))}

// متوسط الفرق المطلق بين مصفوفتي إضاءة متساويتي الطول (قيم 0-255)
export function meanAbsDiff(a,b){if(!a||!b||a.length!==b.length||a.length<1)throw Error('مصفوفتا إضاءة غير متطابقتين');let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return sum/a.length}

// اختيار مواضع اللقطات المفتاحية: البداية دائمًا ثم أعلى درجات التغيير مع منع تجمع المواضع المتجاورة.
// يعيد الفهرس ونوعه: change لتغيّر مرصود فوق عتبة ذات دلالة، fill للقطات زمنية تكميلية لا تُقدَّم كتغيّرات.
export function pickSceneIndices(scores,count){if(!Array.isArray(scores)||scores.length<2)throw Error('عينات غير كافية');if(!Number.isInteger(count)||count<2||count>12)throw Error('عدد اللقطات بين2و12');const n=scores.length,order=[];let max=0;for(let i=1;i<n;i++){const s=scores[i];if(!Number.isFinite(s)||s<0)throw Error('درجة تغير غير صالحة');order.push(i);if(s>max)max=s}
 const threshold=Math.max(3,max*.1),picked=new Map([[0,'fill']]);
 order.sort((a,b)=>scores[b]-scores[a]||a-b);
 for(const i of order){if(picked.size>=count)break;if(scores[i]<threshold)break;if(picked.has(i-1)||picked.has(i+1))continue;picked.set(i,'change')}
 for(const i of order){if(picked.size>=count)break;if(!picked.has(i))picked.set(i,'fill')}
 return[...picked.keys()].sort((a,b)=>a-b).map(i=>({index:i,kind:picked.get(i)}))}
