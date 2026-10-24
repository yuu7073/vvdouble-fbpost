/* VV DOUBLE · FB 貼文 · 1200×800 文字排版（移植自 P1，橫式重排） */
var LAYOUT_W = 1200, LAYOUT_H = 800;
var LAYOUT_FONTS = { YGUIB: 'YGUIB', YGM: 'YGM' };
function LL(o){ return Object.assign({ t:'text', x:.5, y:.5, align:'center', font:'YGUIB', size:48, ls:.15, color:'#FFFFFF' }, o); }
var SWATCH = [{c:'#C9B6E4',n:'淺紫'},{c:'#F2E8DA',n:'奶茶'},{c:'#9FB4CC',n:'霧藍'},{c:'#4A4A4A',n:'經典黑'}];
/* 座標 0～1；橫式照片人物多在中央或一側，所以文字靠左欄／右欄／底部，不壓臉 */
var LAYOUTS = [
 { id:1, name:'1 經典置中', make:function(){ return [
   LL({text:'#夏日繽紛色系', y:.33, size:30, ls:.28}),
   LL({text:'繽紛色系 百搭圓領透膚上衣', y:.44, size:64, ls:.16}),
   LL({text:'永遠不會嫌多的穿搭單品', y:.80, size:40, ls:.22}),
   LL({text:'清涼透氣｜輕薄百搭｜不挑身型', y:.88, size:28, ls:.10})]; } },
 { id:2, name:'2 左上標題・左下賣點', make:function(){ return [
   LL({text:'#夏日繽紛色系', x:.06, y:.14, size:30, ls:.28, align:'left'}),
   LL({text:'百搭圓領透膚上衣', x:.06, y:.24, size:60, ls:.16, align:'left'}),
   LL({text:'清涼透氣｜輕薄百搭｜不挑身型', x:.06, y:.90, size:28, ls:.10, align:'left'})]; } },
 { id:3, name:'3 機能框', make:function(){ return [
   LL({text:'涼感寬褲', x:.06, y:.72, size:66, ls:.20, align:'left'}),
   LL({t:'pills', text:'涼感,透氣,順身', x:.06, y:.86, size:28, ls:.18, align:'left'})]; } },
 { id:4, name:'4 數字規格', make:function(){ return [
   LL({text:'特製大尺碼鞋楦', x:.06, y:.36, size:34, ls:.24, align:'left'}),
   LL({text:'SIZE 38-45', x:.06, y:.50, size:110, ls:.08, align:'left'}),
   LL({text:'寬楦不磨腳・久走不累', x:.06, y:.63, size:32, ls:.18, align:'left'})]; } },
 { id:5, name:'5 側邊直書', make:function(){ return [
   LL({t:'vtext', text:'永遠不會嫌多的穿搭單品', x:.95, y:.08, size:40, ls:.30}),
   LL({text:'#獨家自訂', x:.06, y:.80, size:30, ls:.20, align:'left'}),
   LL({text:'輕薄百搭 不挑身型', x:.06, y:.89, size:38, ls:.16, align:'left'})]; } },
 { id:6, name:'6 Detail 細節標註', make:function(){ return [
   LL({t:'utext', text:'Detail', x:.06, y:.68, size:34, ls:.28, align:'left'}),
   LL({text:'領口包邊車線 不易鬆垮', x:.06, y:.80, size:32, ls:.14, align:'left'}),
   LL({text:'恰到好處的厚度 不透不悶', x:.06, y:.89, size:32, ls:.14, align:'left'})]; } },
 { id:7, name:'7 極簡一行', make:function(){ return [
   LL({t:'line', x:.5, y:.84, size:2, text:'90'}),
   LL({text:'清涼透氣的日常百搭上衣', y:.91, size:36, ls:.26})]; } },
 { id:8, name:'8 上下框線', make:function(){ return [
   LL({t:'line', x:.25, y:.38, size:2, text:'420'}),
   LL({text:'#獨家自訂', x:.25, y:.46, size:30, ls:.26}),
   LL({text:'垂墜感連身裙', x:.25, y:.56, size:60, ls:.20}),
   LL({t:'line', x:.25, y:.65, size:2, text:'420'})]; } },
 { id:9, name:'9 底部白色資訊帶', make:function(){ return [
   LL({t:'band', y:1, size:150, text:'rgba(255,255,255,0.88)'}),
   LL({text:'一件搞定的夏日穿搭', y:.855, size:40, ls:.22, color:'#3A3A3A'}),
   LL({text:'柔軟親膚｜機洗不變形｜四色可選', y:.93, size:28, ls:.08, color:'#6B6B6B'})]; } },
 { id:10, name:'10 大英文＋副標', make:function(){ return [
   LL({text:'NEW IN', x:.06, y:.16, size:110, ls:.16, align:'left'}),
   LL({text:'本週新品搶先看', x:.06, y:.30, size:36, ls:.24, align:'left'})]; } },
 { id:11, name:'11 引號口碑', make:function(){ return [
   LL({text:'“', x:.70, y:.34, size:120, ls:0}),
   LL({text:'穿過一次就回不去了', x:.70, y:.48, size:50, ls:.20}),
   LL({text:'來自門市試穿的真實心得', x:.70, y:.58, size:28, ls:.18})]; } },
 { id:12, name:'12 多色圓點', make:function(){ return [
   LL({text:'舒適滿分圓領短版T恤', y:.80, size:50, ls:.20}),
   LL({t:'dots', y:.905, size:16, layout:'row', tail:'四色可選', colors:SWATCH})]; } },
 { id:13, name:'13 側邊直排色點', make:function(){ return [
   LL({t:'dots', x:.955, y:.5, size:16, layout:'col', colors:SWATCH}),
   LL({text:'#夏日繽紛色系', x:.06, y:.80, size:30, ls:.20, align:'left'}),
   LL({text:'一次收齊四色', x:.06, y:.89, size:44, ls:.18, align:'left'})]; } },
 { id:14, name:'14 布片色票', make:function(){ return [
   LL({text:'棉感寬鬆襯衫', y:.78, size:50, ls:.22}),
   LL({t:'swatches', y:.885, size:26, showNames:true, colors:SWATCH.slice(0,3)})]; } },
 { id:15, name:'15 底邊色帶', make:function(){ return [
   LL({text:'你的日常都能搭的顏色', y:.90, size:36, ls:.24}),
   LL({t:'cband', y:1, size:40, colors:SWATCH})]; } }
];

function lyFont(ctx, ly, s){ ctx.font = (ly.size*s) + 'px ' + (LAYOUT_FONTS[ly.font] || 'YGUIB') + ', "Yu Gothic UI", "Microsoft JhengHei", sans-serif'; ctx.letterSpacing = (ly.ls*ly.size*s) + 'px'; }
function lyTextW(ctx, ly, s, t){ return ctx.measureText(t).width - ly.ls*ly.size*s; }
/* 在 canvas 上畫一層；s = 畫布寬 / 1200 */
function drawLayoutLayer(ctx, ly, s){
  var W = LAYOUT_W*s, H = LAYOUT_H*s, cx = ly.x*W, cy = ly.y*H;
  ctx.save(); ctx.fillStyle = ly.color; ctx.textBaseline = 'middle';
  if (ly.t === 'text' || ly.t === 'utext') {
    lyFont(ctx, ly, s); var tw = lyTextW(ctx, ly, s, ly.text); var x0 = ly.align === 'left' ? cx : cx - tw/2;
    ctx.fillText(ly.text, x0, cy);
    if (ly.t === 'utext') ctx.fillRect(x0, cy + ly.size*s*0.62, tw, Math.max(2, 2.5*s));
  } else if (ly.t === 'vtext') {
    lyFont(ctx, ly, s); ctx.letterSpacing = '0px'; var step = ly.size*s*(1+ly.ls), yy = cy + ly.size*s*0.5;
    Array.from(ly.text).forEach(function(ch){ var w = ctx.measureText(ch).width; ctx.fillText(ch, cx - w/2, yy); yy += step; });
  } else if (ly.t === 'line') {
    var w = Number(ly.text)*s; ctx.fillRect(cx - w/2, cy, w, Math.max(2, ly.size*s));
  } else if (ly.t === 'band') {
    var h = ly.size*s; ctx.fillStyle = ly.text; ctx.fillRect(0, H - h, W, h);
  } else if (ly.t === 'cband') {
    var hh = ly.size*s, ww = W/ly.colors.length; ly.colors.forEach(function(c,i){ ctx.fillStyle = c.c; ctx.fillRect(i*ww, H-hh, ww+1, hh); });
  } else if (ly.t === 'pills') {
    lyFont(ctx, ly, s); var items = ly.text.split(',').map(function(t){ return t.trim(); }).filter(Boolean);
    var padx = ly.size*s*0.55, pady = ly.size*s*0.42, gap = ly.size*s*0.5;
    var ws = items.map(function(t){ return lyTextW(ctx, ly, s, t) + padx*2; }); var total = ws.reduce(function(a,b){ return a+b; }, 0) + gap*(items.length-1);
    var x = ly.align === 'left' ? cx : cx - total/2, ph = ly.size*s + pady*2;
    ctx.lineWidth = Math.max(1.5, 2*s); ctx.strokeStyle = ly.color;
    items.forEach(function(t,i){ ctx.strokeRect(x, cy - ph/2, ws[i], ph); ctx.fillText(t, x + padx, cy + ly.size*s*0.04); x += ws[i] + gap; });
  } else if (ly.t === 'dots') {
    var r = ly.size*s, g = r*2.7, nameFs = 26*s;
    if (ly.layout === 'col') { var th = g*(ly.colors.length-1), y2 = cy - th/2; ly.colors.forEach(function(c){ ctx.beginPath(); ctx.arc(cx, y2, r, 0, 7); ctx.fillStyle = c.c; ctx.fill(); ctx.lineWidth = Math.max(1.5, 2*s); ctx.strokeStyle = '#fff'; ctx.stroke(); y2 += g; }); }
    else { ctx.font = nameFs + 'px YGM, "Yu Gothic", sans-serif'; ctx.letterSpacing = (nameFs*0.1) + 'px'; var tail = ly.tail || ''; var tailW = tail ? ctx.measureText(tail).width + r*1.6 : 0; var totalW = g*(ly.colors.length-1) + tailW, xx = cx - totalW/2;
      ly.colors.forEach(function(c){ ctx.beginPath(); ctx.arc(xx, cy, r, 0, 7); ctx.fillStyle = c.c; ctx.fill(); ctx.lineWidth = Math.max(1.5, 2*s); ctx.strokeStyle = '#fff'; ctx.stroke(); xx += g; });
      if (tail) { ctx.fillStyle = ly.color; ctx.fillText(tail, xx - g + r*1.6, cy + nameFs*0.05); } }
  } else if (ly.t === 'swatches') {
    var sw = ly.size*s*1.7, sh = ly.size*s*1.25, sg = sw*0.45, nf = 24*s, tw2 = sw*ly.colors.length + sg*(ly.colors.length-1), x3 = cx - tw2/2;
    ly.colors.forEach(function(c){ ctx.fillStyle = c.c; ctx.beginPath(); ctx.roundRect(x3, cy - sh/2, sw, sh, 4*s); ctx.fill(); ctx.lineWidth = Math.max(1.5, 2*s); ctx.strokeStyle = '#fff'; ctx.stroke();
      if (ly.showNames && c.n) { ctx.fillStyle = ly.color; ctx.font = nf + 'px YGM, "Yu Gothic", sans-serif'; ctx.letterSpacing = (nf*0.08) + 'px'; var nw = ctx.measureText(c.n).width - nf*0.08; ctx.fillText(c.n, x3 + sw/2 - nw/2, cy + sh/2 + nf*0.85); }
      x3 += sw + sg; });
  }
  ctx.restore();
}
