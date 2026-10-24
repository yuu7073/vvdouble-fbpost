/* VV DOUBLE · FB 貼文 · 直式 678×1028（2:3）文字排版，直接沿用 P1 的 15 個範本（P1 設計空間 1600×2048；本處以寬度等比縮放） */
var LAYOUT_W = 678, LAYOUT_H = 1028, P1_W = 1600;
var LAYOUT_FONTS = { YGUIB: 'YGUIB', YGM: 'YGM' };
var _uid = 1;
function L(o){ return Object.assign({ id:_uid++, t:'text', x:.5, y:.5, align:'center', font:'YGUIB', size:60, ls:.15, color:'#FFFFFF' }, o); }
var P1_TPLS = [
 {id:1, name:'1 經典置中', cat:'new', make:function(){ return [
   L({text:'#夏日繽紛色系', y:.398, size:54, ls:.28}),
   L({text:'繽紛色系',       y:.465, size:106, ls:.18}),
   L({text:'百搭圓領透膚上衣', y:.535, size:106, ls:.18}),
   L({text:'永遠不會嫌多的穿搭單品', y:.866, size:70, ls:.22}),
   L({text:'清涼透氣｜輕薄百搭｜不挑身型', y:.926, size:52, ls:.10})]; }},
 {id:2, name:'2 上標題・下賣點', cat:'new', make:function(){ return [
   L({text:'#夏日繽紛色系', y:.145, size:54, ls:.28}),
   L({text:'百搭圓領透膚上衣', y:.205, size:96, ls:.18}),
   L({text:'清涼透氣｜輕薄百搭｜不挑身型', y:.925, size:52, ls:.10})]; }},
 {id:3, name:'3 機能框', cat:'new', make:function(){ return [
   L({text:'涼感顯瘦寬褲', y:.455, size:100, ls:.20}),
   L({t:'pills', text:'涼感,透氣,顯瘦', y:.885, size:52, ls:.18, x:.5})]; }},
 {id:4, name:'4 數字規格', cat:'new', make:function(){ return [
   L({text:'特製大尺碼鞋楦', y:.398, size:58, ls:.24}),
   L({text:'SIZE 38-45', y:.480, size:150, ls:.10, font:'YGUIB'}),
   L({text:'寬楦不磨腳・久走不累', y:.565, size:54, ls:.18})]; }},
 {id:5, name:'5 側邊直書', cat:'new', make:function(){ return [
   L({t:'vtext', text:'永遠不會嫌多的穿搭單品', x:.915, y:.10, size:66, ls:.34, align:'left'}),
   L({text:'#獨家自訂', x:.075, y:.882, size:50, ls:.20, align:'left'}),
   L({text:'輕薄百搭 不挑身型', x:.075, y:.940, size:58, ls:.16, align:'left'})]; }},
 {id:6, name:'6 Detail 細節標註', cat:'new', make:function(){ return [
   L({t:'utext', text:'Detail', x:.075, y:.822, size:56, ls:.28, align:'left', font:'YGUIB'}),
   L({text:'領口包邊車線 不易鬆垮', x:.075, y:.895, size:54, ls:.14, align:'left'}),
   L({text:'恰到好處的厚度 不透不悶', x:.075, y:.950, size:54, ls:.14, align:'left'})]; }},
 {id:7, name:'7 極簡一行', cat:'new', make:function(){ return [
   L({t:'line', x:.5, y:.905, size:2, ls:0, text:'112'}),
   L({text:'清涼透氣的日常百搭上衣', y:.945, size:60, ls:.26})]; }},
 {id:8, name:'8 上下框線置中', cat:'new', make:function(){ return [
   L({t:'line', x:.5, y:.418, size:2, ls:0, text:'900'}),
   L({text:'#獨家自訂', y:.462, size:52, ls:.26}),
   L({text:'垂墜感顯瘦連身裙', y:.522, size:96, ls:.20}),
   L({t:'line', x:.5, y:.568, size:2, ls:0, text:'900'})]; }},
 {id:9, name:'9 底部白色資訊帶', cat:'new', make:function(){ return [
   L({t:'band', x:.5, y:1.0, size:240, text:'rgba(255,255,255,0.88)', ls:0}),
   L({text:'一件搞定的夏日穿搭', y:.917, size:62, ls:.22, color:'#3A3A3A'}),
   L({text:'遮肉顯瘦｜柔軟親膚｜機洗不變形', y:.965, size:50, ls:.08, color:'#6B6B6B'})]; }},
 {id:10, name:'10 大英文＋副標', cat:'new', make:function(){ return [
   L({text:'NEW IN', y:.140, size:150, ls:.20, font:'YGUIB'}),
   L({text:'本週新品搶先看', y:.215, size:60, ls:.24})]; }},
 {id:11, name:'11 引號口碑', cat:'new', make:function(){ return [
   L({text:'“', y:.395, size:150, ls:0, font:'YGUIB'}),
   L({text:'穿過一次就回不去了', y:.490, size:88, ls:.22}),
   L({text:'來自門市試穿的真實心得', y:.560, size:52, ls:.18})]; }},
 {id:12, name:'12 多色圓點', cat:'new', make:function(){ return [
   L({text:'舒適滿分圓領短版T恤', y:.880, size:80, ls:.20}),
   L({t:'dots', x:.5, y:.940, size:26, ls:0, layout:'row', showNames:false, tail:'四色可選',
      colors:[{c:'#C9B6E4',n:'淺紫'},{c:'#F2E8DA',n:'奶茶'},{c:'#9FB4CC',n:'霧藍'},{c:'#4A4A4A',n:'經典黑'}]})]; }},
 {id:13, name:'13 側邊直排色點', cat:'new', make:function(){ return [
   L({t:'dots', x:.925, y:.50, size:26, ls:0, layout:'col', showNames:false, tail:'',
      colors:[{c:'#C9B6E4',n:'淺紫'},{c:'#F2E8DA',n:'奶茶'},{c:'#9FB4CC',n:'霧藍'},{c:'#4A4A4A',n:'經典黑'}]}),
   L({text:'#夏日繽紛色系', x:.075, y:.882, size:50, ls:.20, align:'left'}),
   L({text:'一次收齊四色', x:.075, y:.942, size:68, ls:.18, align:'left'})]; }},
 {id:14, name:'14 布片色票', cat:'new', make:function(){ return [
   L({text:'棉感寬鬆襯衫', y:.868, size:80, ls:.22}),
   L({t:'swatches', x:.5, y:.925, size:44, ls:0, showNames:true,
      colors:[{c:'#C9B6E4',n:'淺紫'},{c:'#F2E8DA',n:'奶茶'},{c:'#9FB4CC',n:'霧藍'}]})]; }},
  {id:15, name:'15 底邊色帶', cat:'new', make:function(){ return [
   L({text:'你的日常都能搭的顏色', y:.930, size:58, ls:.24}),
   L({t:'cband', x:.5, y:1.0, size:60, ls:0,
      colors:[{c:'#C9B6E4',n:''},{c:'#F2E8DA',n:''},{c:'#9FB4CC',n:''},{c:'#4A4A4A',n:''}]})]; }}
];
var LAYOUTS = P1_TPLS;
function lyFont(ctx, ly, s){ ctx.font = (ly.size*s) + 'px ' + (LAYOUT_FONTS[ly.font] || 'YGUIB') + ', "Yu Gothic UI", "Microsoft JhengHei", sans-serif'; ctx.letterSpacing = (ly.ls*ly.size*s) + 'px'; }
function lyTextW(ctx, ly, s, t){ return ctx.measureText(t).width - ly.ls*ly.size*s; }
/* 在 canvas 上畫一層；W,H = 畫布實際尺寸；字級以 P1 的 1600 寬等比縮放 */
function drawLayoutLayer(ctx, ly, W, H){
  var s = W / P1_W, cx = ly.x*W, cy = ly.y*H;
  ctx.save(); ctx.fillStyle = ly.color; ctx.textBaseline = 'middle';
  if (ly.t === 'text' || ly.t === 'utext') {
    lyFont(ctx, ly, s); var tw = lyTextW(ctx, ly, s, ly.text); var x0 = ly.align === 'left' ? cx : cx - tw/2;
    ctx.fillText(ly.text, x0, cy);
    if (ly.t === 'utext') ctx.fillRect(x0, cy + ly.size*s*0.62, tw, Math.max(2, 3*s));
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
    ctx.lineWidth = Math.max(1.5, 2.5*s); ctx.strokeStyle = ly.color;
    items.forEach(function(t,i){ ctx.strokeRect(x, cy - ph/2, ws[i], ph); ctx.fillText(t, x + padx, cy + ly.size*s*0.04); x += ws[i] + gap; });
  } else if (ly.t === 'dots') {
    var r = ly.size*s, g = r*2.7, nameFs = 40*s;
    if (ly.layout === 'col') { var th = g*(ly.colors.length-1), y2 = cy - th/2; ly.colors.forEach(function(c){ ctx.beginPath(); ctx.arc(cx, y2, r, 0, 7); ctx.fillStyle = c.c; ctx.fill(); ctx.lineWidth = Math.max(1.5, 2.5*s); ctx.strokeStyle = '#fff'; ctx.stroke(); y2 += g; }); }
    else { ctx.font = nameFs + 'px YGM, "Yu Gothic", sans-serif'; ctx.letterSpacing = (nameFs*0.1) + 'px'; var tail = ly.tail || ''; var tailW = tail ? ctx.measureText(tail).width + r*1.6 : 0; var totalW = g*(ly.colors.length-1) + tailW, xx = cx - totalW/2;
      ly.colors.forEach(function(c){ ctx.beginPath(); ctx.arc(xx, cy, r, 0, 7); ctx.fillStyle = c.c; ctx.fill(); ctx.lineWidth = Math.max(1.5, 2.5*s); ctx.strokeStyle = '#fff'; ctx.stroke(); xx += g; });
      if (tail) { ctx.fillStyle = ly.color; ctx.fillText(tail, xx - g + r*1.6, cy + nameFs*0.05); } }
  } else if (ly.t === 'swatches') {
    var sw = ly.size*s*1.7, sh = ly.size*s*1.25, sg = sw*0.45, nf = 38*s, tw2 = sw*ly.colors.length + sg*(ly.colors.length-1), x3 = cx - tw2/2;
    ly.colors.forEach(function(c){ ctx.fillStyle = c.c; ctx.beginPath(); ctx.roundRect(x3, cy - sh/2, sw, sh, 5*s); ctx.fill(); ctx.lineWidth = Math.max(1.5, 2.5*s); ctx.strokeStyle = '#fff'; ctx.stroke();
      if (ly.showNames && c.n) { ctx.fillStyle = ly.color; ctx.font = nf + 'px YGM, "Yu Gothic", sans-serif'; ctx.letterSpacing = (nf*0.08) + 'px'; var nw = ctx.measureText(c.n).width - nf*0.08; ctx.fillText(c.n, x3 + sw/2 - nw/2, cy + sh/2 + nf*0.85); }
      x3 += sw + sg; });
  }
  ctx.restore();
}
