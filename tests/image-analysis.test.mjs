import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {scanJpeg,parseExif,estimateQuality,scanPng,noiseMap,extractExifThumbnail,luminanceGradient,levelSweep,channelHistogram,extractStrings,detectClones,pcaProjections,enhanceRegion} from '../site/journalist-media/image-analysis-core.js';
const jpg=new Uint8Array(readFileSync('tests/fixtures/journalist-photo-exif.jpg'));
test('scanJpeg reads markers, DQT, SOF, EXIF segment',()=>{const s=scanJpeg(jpg);assert.ok(s.markers.length>=5);assert.equal(s.dqt.length,2);assert.equal(s.sof.width,1000);assert.equal(s.sof.height,600);assert.ok(s.exif instanceof Uint8Array)});
test('scanJpeg rejects non-JPEG',()=>{assert.throws(()=>scanJpeg(new Uint8Array([1,2,3,4])))});
test('parseExif reads camera, software, dates and GPS coordinates',()=>{const f=parseExif(scanJpeg(jpg).exif);assert.equal(f.make,'TestCam');assert.equal(f.model,'TC-1');assert.equal(f.software,'UnitTestEditor 1.0');assert.equal(f.modified,'2026:01:02 03:04:05');assert.ok(Math.abs(f.gps.lat-30.044444)<1e-6);assert.ok(Math.abs(f.gps.lon-31.235556)<1e-6);assert.equal(f.gps.altitude,23);assert.equal(f.gps.date,'2026:01:02')});
test('parseExif rejects bad TIFF header',()=>{assert.throws(()=>parseExif(new Uint8Array([0,0,0,0,0,0,0,0])))});
test('estimateQuality near fixture quality 85, always within 1..100',()=>{const q=estimateQuality(scanJpeg(jpg).dqt);assert.ok(q.quality>=80&&q.quality<=95);assert.equal(estimateQuality([]),null)});
test('scanPng reads chunks from real fixture',()=>{const png=new Uint8Array(readFileSync('tests/fixtures/journalist-ocr-arabic.png'));const s=scanPng(png);assert.ok(s.chunks.some(c=>c.type==='IHDR'));assert.ok(s.chunks.some(c=>c.type==='IEND'))});
test('noiseMap flat region silent, spike loud; validates inputs',()=>{const flat=new Uint8ClampedArray(4*5*5);for(let i=0;i<flat.length;i+=4){flat[i]=flat[i+1]=flat[i+2]=100;flat[i+3]=255}const n=noiseMap(flat,5,5,1,8);assert.equal(n.max,0);const spiky=new Uint8ClampedArray(flat);spiky[(2*5+2)*4]=255;const n2=noiseMap(spiky,5,5,1,8);assert.ok(n2.max>50);assert.throws(()=>noiseMap(flat,5,5,0,8));assert.throws(()=>noiseMap(new Uint8ClampedArray(4),5,5,1,8))});

test('detectClones finds true copy-move displacement, clean texture yields none',()=>{
 const W=200,H=140;
 const mk=()=>{const px=new Uint8ClampedArray(W*H*4);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;px[i]=(x*3+y*7)%256;px[i+1]=(x*5+y*11)%256;px[i+2]=(x*x+y)%256;px[i+3]=255}return px};
 const px=mk();
 for(let y=0;y<48;y++)for(let x=0;x<48;x++){const s=((20+y)*W+20+x)*4,t=((80+y)*W+120+x)*4;for(let c=0;c<3;c++)px[t+c]=px[s+c]}
 const r=detectClones(px,W,H);
 assert.equal(r.groups.length,1);assert.equal(r.groups[0].dx,100);assert.equal(r.groups[0].dy,60);
 assert.ok(r.groups[0].count>=60&&r.groups[0].pairs.length>=60);
 assert.equal(detectClones(mk(),W,H).groups.length,0);
 assert.ok(detectClones(new Uint8ClampedArray(30*30*4),30,30).note.includes('أصغر'))});
test('luminanceGradient edges bright, flat dark; validates input',()=>{
 const W=20,H=20,px=new Uint8ClampedArray(W*H*4);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,v=x<10?0:255;px[i]=px[i+1]=px[i+2]=v;px[i+3]=255}
 const g=luminanceGradient(px,W,H);
 assert.equal(g.output[(10*W+5)*4],0);
 assert.ok(g.output[(10*W+10)*4]>100);
 assert.throws(()=>luminanceGradient(new Uint8ClampedArray(4),2,2))});
test('levelSweep keeps only pixels near level',()=>{
 const px=new Uint8ClampedArray([0,0,0,255, 128,128,128,255, 255,255,255,255]);
 const r=levelSweep(px,128,10);
 assert.equal(r.output[0],0);assert.equal(r.output[4],255);assert.equal(r.output[8],0);
 assert.throws(()=>levelSweep(px,300))});
test('channelHistogram bins and max',()=>{
 const px=new Uint8ClampedArray([255,0,0,255, 255,0,0,255]);
 const h=channelHistogram(px);
 assert.equal(h.r[255],2);assert.equal(h.g[0],2);assert.equal(h.max,2)});
test('extractStrings hint filter finds software traces',()=>{
 const bytes=new TextEncoder().encode('  Made with Adobe Photoshop 2021   plaintext here ');
 const s=extractStrings(bytes);
 assert.ok(s.some(x=>x.text.includes('Adobe Photoshop')));
 assert.ok(!s.some(x=>x.text==='plaintext here'))});
test('extractExifThumbnail null when absent',()=>{
 const f=parseExif(scanJpeg(jpg).exif);
 assert.equal(extractExifThumbnail(scanJpeg(jpg).exif),null)});

test('pcaProjections recovers dominant axes, normalizes output, validates input',()=>{
 const W=40,H=30,px=new Uint8ClampedArray(W*H*4);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;px[i]=x*6;px[i+1]=y*8;px[i+2]=128;px[i+3]=255}
 const r=pcaProjections(px,W,H);
 assert.equal(r.components.length,3);assert.equal(r.components[0].length,W*H);
 assert.ok(r.variances[0]>=r.variances[1]&&r.variances[1]>=r.variances[2],'variances sorted');
 assert.ok(r.variances[2]<1,'flat channel carries no variance');
 assert.equal(Math.max(...r.components[0]),255);assert.equal(Math.min(...r.components[0]),0);
 const flat=pcaProjections(new Uint8ClampedArray(16*4).fill(128),4,4);
 assert.ok(flat.variances.every(v=>v===0),'flat image zero variance');
 assert.throws(()=>pcaProjections(new Uint8ClampedArray(4),2,2));});

test('enhanceRegion equalize spans range, auto-contrast stretches, none passthrough, bad mode throws',()=>{
 const reg=new Uint8ClampedArray(40*40*4);
 for(let i=0;i<reg.length;i+=4){reg[i]=60;reg[i+1]=80;reg[i+2]=100;reg[i+3]=255}
 reg[0]=reg[1]=reg[2]=0;reg[reg.length-4]=reg[reg.length-3]=reg[reg.length-2]=255;
 const eq=enhanceRegion(reg.slice(),{mode:'equalize'});
 assert.equal(Math.min(...eq.filter((_,i)=>i%4===0)),0);assert.equal(Math.max(...eq.filter((_,i)=>i%4===0)),255);
 const ac=enhanceRegion(reg.slice(),{mode:'auto-contrast'});
 assert.equal(ac[0],0);assert.equal(ac[reg.length-4],255);
 const same=new Uint8ClampedArray([10,20,30,255]);
 assert.equal(enhanceRegion(same,{mode:'none'}),same);
 assert.throws(()=>enhanceRegion(same.slice(),{mode:'bogus'}));
 assert.throws(()=>enhanceRegion(new Uint8ClampedArray(3),{mode:'none'}));});
