/**
 * =========================================================================================
 * 🧠 MASTER PROJECT CONTEXT & DOCUMENTATION (AI CONTEXT RETAINER)
 * =========================================================================================
 * NOM DU PROJET : Mes Cours - PC* Edition
 * TYPE : Module utilitaire global (qr-generator.js)
 * * 🏗️ RÔLE DE CE FICHIER DANS L'ARCHITECTURE :
 * Ce fichier a été isolé de l'index.html principal pour ne pas polluer la vue.
 * Il contient le moteur mathématique permettant de générer des codes QR
 * 100 % HORS-LIGNE sans faire d'appel à une API externe payante ou instable.
 * * 🚀 FONCTIONNEMENT :
 * Il utilise l'algorithme de correction d'erreurs Reed-Solomon et les polynômes
 * pour transformer une chaîne de caractères (l'UID d'un cours) en une matrice 
 * dessinable sur un Canvas HTML5. Il exporte ensuite le résultat en image (Base64).
 * * 🛑 DIRECTIVES STRICTES DE L'UTILISATEUR :
 * - Le code contenu ici est ultra-spécifique, minifié et optimisé mathématiquement. 
 * - Ne cherche JAMAIS à le modifier, le reformater ou l'optimiser pour gagner des lignes.
 * - Ne JAMAIS supprimer ce fichier, l'application entière repose dessus pour l'impression.
 * * 🤖 REMARQUES DE L'IA (DÉVELOPPEUR ACTUEL) :
 * - L'objet principal `_QR` est exposé globalement via `window._QR`. 
 * Il expose la fonction `makeImageURL(text, size)` qui retourne un DataURL en PNG.
 * - Ce fichier est chargé statiquement dans `<head>` ou à la fin du `<body>` via 
 * une balise `<script src="qr-generator.js"></script>`.
 * =========================================================================================
 */

window._QR = (function(){
  var EXP = new Array(256);
  var LOG = new Array(256);
  
  (function(){ 
    for(var i=0; i<8; i++) EXP[i]=1<<i; 
    for(var i=8; i<256; i++) EXP[i]=EXP[i-4]^EXP[i-5]^EXP[i-6]^EXP[i-8]; 
    for(var i=0; i<255; i++) LOG[EXP[i]]=i; 
  })();
  
  var RS = { 
    glog: function(n){ return LOG[n]; }, 
    gexp: function(n){ 
      while(n<0) n+=255; 
      while(n>=256) n-=255; 
      return EXP[n]; 
    }, 
    mul: function(a,b){ 
      return (a===0 || b===0) ? 0 : EXP[(LOG[a]+LOG[b])%255]; 
    } 
  };
  
  function Poly(num, shift){ 
    var o = 0; 
    while(o < num.length && num[o]===0) o++; 
    this.n = new Array(num.length - o + shift); 
    for(var i=0; i<num.length-o; i++) this.n[i] = num[i+o]; 
  }
  
  Poly.prototype = { 
    len: function(){ return this.n.length; }, 
    get: function(i){ return this.n[i]; },
    mul: function(e){ 
      var n = new Array(this.len() + e.len() - 1); 
      for(var i=0; i<this.len(); i++) {
        for(var j=0; j<e.len(); j++) {
          n[i+j] ^= RS.mul(this.get(i), e.get(j)); 
        }
      }
      return new Poly(n, 0); 
    },
    mod: function(e){ 
      if(this.len() - e.len() < 0) return this; 
      var r = RS.glog(this.get(0)) - RS.glog(e.get(0));
      var n = this.n.slice(); 
      for(var i=0; i<e.len(); i++) n[i] ^= RS.gexp(RS.glog(e.get(i)) + r); 
      return new Poly(n, 0).mod(e); 
    }
  };
  
  var RST = [
    [1,26,19], [1,26,16], [1,26,13], [1,26,9], 
    [1,44,34], [1,44,28], [1,44,22], [1,44,16], 
    [1,70,55], [1,70,44], [2,35,17], [2,35,13]
  ];
  
  function getRSB(t,e){ 
    var row = RST[(t-1)*4+e];
    var list = []; 
    for(var i=0; i<row.length; i+=3) {
      for(var j=0; j<row[i]; j++) list.push({tot:row[i+1], dat:row[i+2]}); 
    }
    return list; 
  }
  
  function getECP(ecl){ 
    var a = new Poly([1], 0); 
    for(var i=0; i<ecl; i++) a = a.mul(new Poly([1, RS.gexp(i)], 0)); 
    return a; 
  }
  
  var PP = [ [], [6,18], [6,22] ];
  var G15 = (1<<10)|(1<<8)|(1<<5)|(1<<4)|(1<<2)|(1<<1)|(1<<0);
  var G15M = (1<<14)|(1<<12)|(1<<10)|(1<<4)|(1<<1);
  
  function bchd(d){ var g=0; while(d!==0){ g++; d>>>=1; } return g; }
  
  function bchTI(d){ 
    var x = d<<10; 
    while(bchd(x) - bchd(G15) >= 0) x ^= (G15 << (bchd(x) - bchd(G15))); 
    return ((d<<10)|x)^G15M; 
  }
  
  function maskFn(p){ return function(i,j){ return (i+j)%2 === 0; }; }
  
  function makeQR(text){
    var ecLevel = 0, t = 2, rsb = getRSB(t,ecLevel);
    var buf = {
      bits: [], 
      len: 0, 
      put: function(v,n){ 
        for(var i=0; i<n; i++) this.bits.push((v>>>(n-i-1))&1 === 1); 
        this.len += n; 
      }
    };
    
    buf.put(4,4); 
    buf.put(text.length, 8);
    for(var i=0; i<text.length; i++) buf.put(text.charCodeAt(i), 8);
    
    var totalData = rsb.reduce(function(a,b){ return a + b.dat; }, 0);
    if(buf.len + 4 <= totalData*8) buf.put(0,4);
    while(buf.len % 8 !== 0) { buf.bits.push(0); buf.len++; }
    while(buf.len < totalData*8){ 
      buf.put(0xEC,8); 
      if(buf.len < totalData*8) buf.put(0x11,8); 
    }
    
    var bytes = [];
    for(var i=0; i<buf.bits.length; i+=8){
      var b=0; 
      for(var j=0; j<8; j++) b = (b<<1) | (buf.bits[i+j] || 0); 
      bytes.push(b);
    }
    
    var dcData = [], ecData = [], offset = 0, maxDC = 0, maxEC = 0;
    for(var r=0; r<rsb.length; r++){
      var dc = rsb[r].dat;
      var ec = rsb[r].tot - dc;
      maxDC = Math.max(maxDC, dc);
      maxEC = Math.max(maxEC, ec);
      dcData.push(bytes.slice(offset, offset+dc));
      offset += dc;
      
      var rsp = getECP(ec);
      var raw = new Poly(dcData[r].concat(new Array(ec).fill(0)), 0);
      var mod = raw.mod(rsp);
      ecData.push([]);
      for(var i=0; i<ec; i++){
        var mi = i + mod.len() - ec;
        ecData[r].push(mi >= 0 ? mod.get(mi) : 0);
      }
    }
    
    var total = rsb.reduce(function(a,b){ return a + b.tot; }, 0);
    var data = new Array(total);
    var idx = 0;
    for(var i=0; i<maxDC; i++) {
      for(var r=0; r<rsb.length; r++){
        if(i < dcData[r].length) data[idx++] = dcData[r][i];
      }
    }
    for(var i=0; i<maxEC; i++) {
      for(var r=0; r<rsb.length; r++){
        if(i < ecData[r].length) data[idx++] = ecData[r][i];
      }
    }
    
    var mc = t*4+17;
    var M = [];
    for(var i=0; i<mc; i++){ M.push(new Array(mc).fill(null)); }
    
    function setFP(row,col){
      for(var r=-1; r<=7; r++){
        for(var c=-1; c<=7; c++){
          if(row+r < 0 || mc <= row+r || col+c < 0 || mc <= col+c) continue;
          M[row+r][col+c] = ((0<=r && r<=6 && (c===0 || c===6)) || (0<=c && c<=6 && (r===0 || r===6)) || (2<=r && r<=4 && 2<=c && c<=4));
        }
      }
    }
    
    setFP(0,0); setFP(mc-7,0); setFP(0,mc-7);
    
    var pp = PP[t-1]; 
    for(var i=0; i<pp.length; i++){
      for(var j=0; j<pp.length; j++){
        var row = pp[i], col = pp[j];
        if(M[row][col] !== null) continue;
        for(var r=-2; r<=2; r++){
          for(var c=-2; c<=2; c++){
            M[row+r][col+c] = (r===-2 || r===2 || c===-2 || c===2 || (r===0 && c===0));
          }
        }
      }
    }
    
    for(var r=8; r<mc-8; r++){ if(M[r][6] === null) M[r][6] = (r%2 === 0); }
    for(var c=8; c<mc-8; c++){ if(M[6][c] === null) M[6][c] = (c%2 === 0); }
    
    var bits2 = bchTI((ecLevel<<3) | 0);
    for(var i=0; i<15; i++){
      var mod = ((bits2>>i)&1) === 1;
      if(i<6) M[i][8] = mod;
      else if(i<8) M[i+1][8] = mod;
      else M[mc-15+i][8] = mod;
      
      if(i<8) M[8][mc-i-1] = mod;
      else if(i<9) M[8][15-i] = mod;
      else M[8][15-i-1] = mod;
    }
    M[mc-8][8] = true;
    
    var inc = -1, row2 = mc-1, bi = 7, by = 0, mfn = maskFn(0);
    for(var col=mc-1; col>0; col-=2){
      if(col === 6) col--;
      while(true){
        for(var c=0; c<2; c++){
          if(M[row2][col-c] === null){
            var dark = (by < data.length) && ((data[by] >>> bi) & 1) === 1;
            if(mfn(row2, col-c)) dark = !dark;
            M[row2][col-c] = dark;
            bi--;
            if(bi < 0){ by++; bi=7; }
          }
        }
        row2 += inc;
        if(row2 < 0 || mc <= row2){
          row2 -= inc; inc = -inc; break;
        }
      }
    }
    return {matrix:M, mc:mc};
  }
  
  return {
    makeImageURL: function(text, size){
      try {
        var qr = makeQR(text);
        var cv = document.createElement('canvas'); 
        cv.width = size; 
        cv.height = size;
        var ctx = cv.getContext('2d'); 
        ctx.fillStyle = '#ffffff'; 
        ctx.fillRect(0, 0, size, size); 
        ctx.fillStyle = '#000000';
        var cs = size / qr.mc;
        for(var r=0; r<qr.mc; r++){
          for(var c=0; c<qr.mc; c++){
            if(qr.matrix[r][c]){
              ctx.fillRect(Math.floor(c*cs), Math.floor(r*cs), Math.ceil(cs+.5), Math.ceil(cs+.5));
            }
          }
        }
        return cv.toDataURL('image/png');
      } catch(e) { return ''; }
    }
  };
})();
