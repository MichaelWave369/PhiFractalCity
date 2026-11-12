/* ΦFractalCity R0.4: an in-world WebXR workshop console.
   Only creates visual geometry and raycast targets; state mutations stay in main.js.
   The panel is fixed relative to the visitor rig, not a tested wrist attachment.
 */
export function createXRConsole(THREE, rig) {
  const group=new THREE.Group();
  group.position.set(-0.47,1.55,-1.55);
  group.visible=false;
  rig.add(group);
  let targets=[];
  const disposal={geometries:[],materials:[],textures:[]};
  const palette={
    bg:0x10192f,border:0x3a5685,text:'#dcecff',soft:'#9fb3d4',
    primary:0x496f9a,accent:0x2a897f,muted:0x303d5c,danger:0x9a4f6f
  };
  function material(color,opts={}){
    const m=new THREE.MeshBasicMaterial({color,...opts});
    disposal.materials.push(m);
    return m;
  }
  function rectangle(w,h,x,y,z,color){
    const geo=new THREE.PlaneGeometry(w,h);
    disposal.geometries.push(geo);
    const mesh=new THREE.Mesh(geo,material(color,{side:THREE.DoubleSide}));
    mesh.position.set(x,y,z);group.add(mesh);
    return mesh;
  }
  function label(text,x,y,w=.85,h=.09,{size=34,color=palette.text,lines=1}={}){
    const canvas=document.createElement('canvas');
    canvas.width=1024;canvas.height=Math.round(128*lines);
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle=color;ctx.font='600 '+size+'px sans-serif';ctx.textAlign='left';
    ctx.textBaseline='middle';
    const raw=String(text).replace(/\s+/g,' ').trim();
    const words=raw.split(' ');
    const output=[];let current='';
    for(const word of words){
      if(ctx.measureText((current?current+' ':'')+word).width>970&&current){
        output.push(current);current=word;
      }else current+=(current?' ':'')+word;
    }
    if(current)output.push(current);
    const visible=output.slice(0,lines);
    if(output.length>lines){
      const last=visible[visible.length-1];
      visible[visible.length-1]=last.slice(0,Math.max(1,last.length-2))+'…';
    }
    visible.forEach((line,i)=>ctx.fillText(line,24,64+i*128,970));
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    disposal.textures.push(texture);
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),
      material(0xffffff,{map:texture,transparent:true,side:THREE.DoubleSide,depthWrite:false}));
    disposal.geometries.push(mesh.geometry);
    mesh.position.set(x,y,.024);group.add(mesh);return mesh;
  }
  function button(text,action,data,x,y,w,h=.105,shade=palette.primary){
    const hit=rectangle(w,h,x,y,.035,shade);
    hit.userData.interaction={kind:'xr-console',action,data};
    targets.push(hit);
    label(text,x-w/2+.016,y,w-.032,h*.78,{size:34});
    return hit;
  }
  function clear(){
    targets=[];
    group.clear();
    disposal.geometries.forEach(x=>x.dispose());
    disposal.materials.forEach(x=>x.dispose());
    disposal.textures.forEach(x=>x.dispose());
    disposal.geometries.length=0;
    disposal.materials.length=0;
    disposal.textures.length=0;
  }
  function render(state){
    clear();
    rectangle(1.02,1.48,0,0,-.01,palette.bg);
    label('Φ WORKSHOP / XR CONSOLE',-.47,.655,.92,.105,{size:37,color:'#82e0da'});
    label('POCKET '+state.pocket,-.47,.565,.92,.075,{size:30,color:palette.soft});
    button('PROPOSALS','tab','proposals',-.236,.454,.455,.105,
      state.tab==='proposals'?palette.accent:palette.muted);
    button('EXHIBITS','tab','gallery',.236,.454,.455,.105,
      state.tab==='gallery'?palette.accent:palette.muted);
    if(state.tab==='proposals'){
      const item=state.proposal;
      label('PENDING REVIEW',-.47,.346,.91,.073,{size:33,color:'#a6d9ff'});
      label(item ? item.kind.toUpperCase()+' · '+item.source.toUpperCase() : 'No pending proposals',
        -.47,.263,.91,.077,{size:28,color:palette.soft});
      label(item?.summary||'Create a proposal using the desktop workshop.',
        -.47,.105,.91,.205,{size:31,lines:3});
      button('PREV','prev-proposal',null,-.238,-.078,.455);
      button('NEXT','next-proposal',null,.238,-.078,.455);
      label(state.armedText||'Two-step confirmation before review',-.47,-.183,.91,.073,
        {size:27,color:state.armedText?'#f3cfac':palette.soft});
      button('APPROVE','approve',null,-.238,-.292,.455,.105,palette.accent);
      button('DECLINE','decline',null,.238,-.292,.455,.105,palette.danger);
    }else{
      const item=state.artifact;
      label('APPROVED CONCEPTS',-.47,.346,.91,.073,{size:33,color:'#a6d9ff'});
      label(item ? item.kind.toUpperCase()+' · '+item.source.toUpperCase() : 'No published concepts',
        -.47,.263,.91,.076,{size:28,color:palette.soft});
      label(item?.summary||'Approve a proposal to make it available here.',
        -.47,.125,.91,.17,{size:31,lines:2});
      button('PREV','prev-artifact',null,-.238,.00,.455,.084);
      button('NEXT','next-artifact',null,.238,.00,.455,.084);
      label(state.placement?'SELECTED '+state.placement.id+' · X:'+state.placement.x+' Z:'+state.placement.z:
        'No placed concept selected',-.47,-.10,.91,.075,{size:27,color:palette.soft});
      button('PLACE','place',null,-.238,-.20,.455,.09,palette.accent);
      button('ROTATE','rotate',null,.238,-.20,.455,.09);
      button('←','move-left',null,-.358,-.305,.217,.09);
      button('↑','move-forward',null,-.12,-.305,.217,.09);
      button('↓','move-back',null,.12,-.305,.217,.09);
      button('→','move-right',null,.358,-.305,.217,.09);
      label(state.armedText||'Selecting a 3D exhibit edits its placement.',
        -.47,-.405,.91,.068,{size:25,color:state.armedText?'#f3cfac':palette.soft});
      button('REMOVE','remove',null,0,-.494,.93,.085,palette.danger);
    }
    button('CLOSE · LEFT GRIP TO REOPEN','close',null,0,-.633,.93,.092,palette.muted);
    label('LOCAL SESSION · NO SERVER SYNC',-.47,-.713,.92,.043,{size:23,color:palette.soft});
  }
  return {
    group,get targets(){return targets;},render,
    show(){group.visible=true;},
    hide(){group.visible=false;},
    toggle(){group.visible=!group.visible;return group.visible;},
    isVisible(){return group.visible;},
    dispose(){clear();rig.remove(group);}
  };
}
