/* R0.6: deterministic, visitor-triggered conversation presets for immersive VR.
 * Prompts never embed home vault or other private state.
 */
export const XR_PROMPTS=Object.freeze([
  Object.freeze({id:'welcome',label:'Meet Ori',question:'Ori, welcome me to this pocket. What can we explore together?'}),
  Object.freeze({id:'geometry',label:'Study the geometry',question:'Ori, what fractal or spatial pattern could we investigate in this pocket?'}),
  Object.freeze({id:'commons',label:'Improve the Commons',question:'Ori, suggest a voluntary, welcoming activity for residents in this pocket.'}),
  Object.freeze({id:'workshop',label:'Workshop idea',question:'Ori, suggest one small prototype we could discuss and manually review for this pocket.'})
]);
export const MAX_PAGE_CHARS=175;
export const MAX_MESSAGE_CHARS=900;
export function promptByIndex(index) {
  if(!Number.isInteger(index))throw new Error('Invalid conversation preset index');
  return XR_PROMPTS[((index%XR_PROMPTS.length)+XR_PROMPTS.length)%XR_PROMPTS.length];
}
export function paginateResponse(text, pageSize=MAX_PAGE_CHARS) {
  if(typeof text!=='string'||!Number.isInteger(pageSize)||pageSize<80||pageSize>240) {
    throw new Error('Invalid dialogue');
  }
  const normalized=text.trim().replace(/\s+/g,' ').slice(0,MAX_MESSAGE_CHARS);
  if(!normalized)return [];
  const pages=[];
  let rest=normalized;
  while(rest.length){
    if(rest.length<=pageSize){pages.push(rest);break;}
    let breakAt=rest.lastIndexOf(' ',pageSize);
    if(breakAt<pageSize*.55)breakAt=pageSize;
    pages.push(rest.slice(0,breakAt).trim());
    rest=rest.slice(breakAt).trimStart();
  }
  return pages;
}
export function dialogueView(reply, pageIndex=0) {
  const pages=reply?.text?paginateResponse(reply.text):[];
  const valid=pages.length>0&&Number.isInteger(pageIndex)
    ?((pageIndex%pages.length)+pages.length)%pages.length:0;
  return {
    page:pages[valid]||'',
    index:valid,
    total:pages.length,
    model:reply?.model||'',
    address:reply?.address||''
  };
}
