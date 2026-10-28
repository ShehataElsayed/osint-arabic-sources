// OCR review aid: rule-based flagging of suspect tokens for HUMAN review.
// Flags only; never auto-corrects. The extracted text stays exactly as the
// engine produced it - review means the journalist compares against the image.
const AR_DIGIT=/[٠-٩]/,EN_DIGIT=/[0-9]/,AR_LETTER=/[ء-غف-يٱ-ٳے]/,EN_LETTER=/[a-zA-Z]/;
export function flagSuspectTokens(text,{limit=100}={}){
 if(typeof text!=='string')throw Error('نص غير صالح');
 if(!text)return[];
 const flags=[],re=/\S+/g;let m;
 while((m=re.exec(text))&&flags.length<limit){
  const raw=m[0],token=raw.replace(/^[،,;.:"'()\[\]{}«»؟!-]+|[،,;.:"'()\[\]{}«»؟!-]+$/g,'');
  if(token.length<2)continue;
  const reasons=[];
  const hasArD=AR_DIGIT.test(token),hasEnD=EN_DIGIT.test(token);
  if(hasArD&&hasEnD)reasons.push('mixed-digits');
  const hasArL=AR_LETTER.test(token),hasEnL=EN_LETTER.test(token);
  if(hasArD&&hasArL)reasons.push('digit-glued-to-word');
  else if(hasEnD&&hasArL)reasons.push('digit-glued-to-word');
  if(hasArL&&hasEnL)reasons.push('mixed-letters');
  if(reasons.length)flags.push({token,index:m.index,reasons})}
 return flags}
