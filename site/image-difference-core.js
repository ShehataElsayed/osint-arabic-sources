// Pixel difference only. It cannot classify authenticity or fabrication.
export function jpegDifference(original,recompressed,scale=20){
 if(!(original instanceof Uint8ClampedArray)||!(recompressed instanceof Uint8ClampedArray)||original.length!==recompressed.length||original.length%4||!Number.isFinite(scale)||scale<1||scale>100)throw Error('مدخلات المقارنة غير صالحة');
 const output=new Uint8ClampedArray(original.length),histogram=Array(256).fill(0);let sum=0,max=0;
 for(let i=0;i<original.length;i+=4){let peak=0;for(let c=0;c<3;c++){const diff=Math.abs(original[i+c]-recompressed[i+c]);sum+=diff;max=Math.max(max,diff);peak=Math.max(peak,diff);output[i+c]=Math.min(255,diff*scale)}output[i+3]=255;histogram[peak]++}
 return {output,mean:original.length?sum/(original.length/4*3):0,max,histogram,pixels:original.length/4};
}
