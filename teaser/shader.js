/* Fond WebGL2 partagé. Les scènes pilotent NX.bg (voir BG_DEFAULT dans engine.js) :
 * nebula  : aurore/nébuleuse fbm aux couleurs du spectre (0..1)
 * warp    : force de la déformation de domaine de la nébuleuse
 * hue     : décalage le long du spectre (0 = cyan … 1 = fuchsia)
 * rays    : rayons volumétriques depuis (rayX, rayY) en unités écran centrées (y vers le haut, ±0.5 en hauteur)
 * grid    : sol quadrillé en perspective (gridSpeed = défilement, gridHorizon = hauteur de l'horizon)
 * tunnel  : traînées radiales « hyperespace » (tunnelSpeed)
 * stars   : poussière d'étoiles scintillante
 * zoom/cx/cy : caméra 2D du fond ; flash : lumière additive ; intensity : gain global ; speed : vitesse du temps du fond
 * pulse   : pulsation lumineuse (0..1) à brancher sur NX.pulse pour respirer au tempo */
(function () {
  const VS = `#version 300 es
  in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
  const FS = `#version 300 es
  precision highp float;
  uniform vec2 uRes; uniform float uTime;
  uniform float uIntensity,uNebula,uWarp,uHue,uRays,uRayStrength,uGrid,uGridSpeed,uGridHorizon,uTunnel,uTunnelSpeed,uStars,uZoom,uFlash,uPulse;
  uniform vec2 uRayPos,uCenter;
  out vec4 o;
  float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
  float hash1(float n){ return fract(sin(n*127.1)*43758.5453); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
  float fbm(vec2 p){ float s=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<5;i++){ s+=a*noise(p); p=m*p; a*=.5; } return s; }
  vec3 spectrum(float x){
    vec3 c0=vec3(.404,.910,.976), c1=vec3(.506,.549,.973), c2=vec3(.655,.545,.980), c3=vec3(.910,.475,.976);
    x=clamp(x,0.,1.)*3.;
    if(x<1.) return mix(c0,c1,x); if(x<2.) return mix(c1,c2,x-1.); return mix(c2,c3,x-2.);
  }
  float tri(float x){ return abs(fract(x)*2.-1.); } // replie le spectre sans saut
  void main(){
    vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
    vec2 q=(uv-uCenter)/uZoom;
    float t=uTime;
    vec3 col=vec3(.008,.024,.067);
    // Nébuleuse / aurore
    if(uNebula>0.001){
      vec2 p=q*1.35;
      vec2 w=vec2(fbm(p+vec2(0.,t*.06)), fbm(p+vec2(5.2,1.3)-t*.05));
      float n=fbm(p+uWarp*2.2*w+vec2(t*.03,-t*.02));
      float band=smoothstep(.42,.95,n);
      vec3 c=spectrum(tri(n*.9+w.x*.5+uHue*.5));
      float fall=1.-smoothstep(.2,1.25,length(q*vec2(.8,1.)));
      col+=c*band*band*.42*uNebula*fall;
      col+=vec3(.08,.06,.16)*smoothstep(.3,.8,n)*uNebula*.35*fall; // fond violet diffus
    }
    // Rayons volumétriques
    if(uRays>0.001){
      vec2 d=q-uRayPos; float r=length(d);
      // Bruit échantillonné sur le cercle unité : périodique en angle, donc aucune couture à ±π
      vec2 dir=d/max(r,1e-4);
      float s=fbm(dir*4.5+vec2(0.,t*.25))*.65+fbm(dir*12.+vec2(7.,-t*.4))*.35;
      s=pow(smoothstep(.35,.85,s),2.);
      float fallr=exp(-r*1.15);
      col+=spectrum(tri(.25+dir.x*.22+uHue*.5))*s*fallr*uRays*.75*uRayStrength;
      col+=vec3(.75,.85,1.)*exp(-r*r*22.)*uRays*.35*uRayStrength;
    }
    // Sol quadrillé en perspective
    if(uGrid>0.001 && q.y<uGridHorizon){
      float h=uGridHorizon-q.y;
      float z=.28/h;
      vec2 g=vec2(q.x*z*1.4, z+t*uGridSpeed);
      vec2 gf=abs(fract(g)-.5);
      vec2 fw=fwidth(g)*1.2;
      float gx=smoothstep(.5-fw.x*1.5,.5,gf.x), gy=smoothstep(.5-fw.y*1.5,.5,gf.y);
      float gl=max(gx,gy);
      float fade=exp(-z*.09)*smoothstep(0.,.08,h);
      col+=spectrum(tri(.15+q.x*.35+uHue*.5))*gl*fade*uGrid*.55;
      col+=spectrum(.4)*exp(-h*28.)*uGrid*.25; // lueur d'horizon
    }
    // Hyperespace
    if(uTunnel>0.001){
      float a=atan(q.y,q.x)/6.28318+.5; float r=length(q);
      float N=220.; float id=floor(a*N); float h=hash1(id);
      float fa=abs(fract(a*N)-.5);
      float head=fract(h*9.1+t*uTunnelSpeed*(.35+h*.9));
      float rr=head*head*1.6; float len=.05+h*.25*uTunnelSpeed;
      float on=smoothstep(rr-len,rr,r)*(1.-smoothstep(rr,rr+.01,r));
      float thin=1.-smoothstep(.05,.35,fa);
      col+=spectrum(h)*on*thin*uTunnel*(.6+h)*smoothstep(.02,.3,r);
    }
    // Étoiles
    if(uStars>0.001){
      vec2 sp=q*28.; vec2 id=floor(sp); vec2 f=fract(sp)-.5;
      float h=hash(id); vec2 o2=vec2(hash(id+3.1),hash(id+7.7))-.5;
      float d=length(f-o2*.7);
      float tw=.55+.45*sin(t*(1.+h*3.)+h*40.);
      col+=spectrum(h)*smoothstep(.06,.0,d)*step(.86,h)*tw*uStars*1.4;
    }
    col*=uIntensity*(1.+uPulse*.35);
    col+=vec3(.55,.75,1.)*uFlash;
    col+=(hash(gl_FragCoord.xy+fract(t)*91.)-.5)/255.*1.5; // tramage anti-banding
    o=vec4(col,1.);
  }`;
  let gl, prog, loc = {};
  const names = ['uRes', 'uTime', 'uIntensity', 'uNebula', 'uWarp', 'uHue', 'uRays', 'uRayStrength', 'uGrid', 'uGridSpeed', 'uGridHorizon', 'uTunnel', 'uTunnelSpeed', 'uStars', 'uZoom', 'uFlash', 'uPulse', 'uRayPos', 'uCenter'];
  function compile(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  NX.shader = {
    init(canvas) {
      gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false });
      if (!gl) { console.error('WebGL2 indisponible'); return; }
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const p = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(p); gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
      for (const n of names) loc[n] = gl.getUniformLocation(prog, n);
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    draw(t, B) {
      if (!gl) return;
      gl.uniform2f(loc.uRes, 1920, 1080);
      gl.uniform1f(loc.uTime, t * B.speed);
      gl.uniform1f(loc.uIntensity, B.intensity); gl.uniform1f(loc.uNebula, B.nebula); gl.uniform1f(loc.uWarp, B.warp);
      gl.uniform1f(loc.uHue, B.hue); gl.uniform1f(loc.uRays, B.rays); gl.uniform1f(loc.uRayStrength, B.rayStrength);
      gl.uniform1f(loc.uGrid, B.grid); gl.uniform1f(loc.uGridSpeed, B.gridSpeed); gl.uniform1f(loc.uGridHorizon, B.gridHorizon);
      gl.uniform1f(loc.uTunnel, B.tunnel); gl.uniform1f(loc.uTunnelSpeed, B.tunnelSpeed); gl.uniform1f(loc.uStars, B.stars);
      gl.uniform1f(loc.uZoom, B.zoom); gl.uniform1f(loc.uFlash, B.flash); gl.uniform1f(loc.uPulse, B.pulse);
      gl.uniform2f(loc.uRayPos, B.rayX, B.rayY); gl.uniform2f(loc.uCenter, B.cx, B.cy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
})();
