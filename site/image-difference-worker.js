import {jpegDifference} from './image-difference-core.js';
self.onmessage=({data})=>{try{const r=jpegDifference(new Uint8ClampedArray(data.original),new Uint8ClampedArray(data.compressed),data.scale);self.postMessage({...r,output:r.output.buffer},[r.output.buffer])}catch{self.postMessage({error:'تعذّر حساب فرق البكسلات.'})}};
