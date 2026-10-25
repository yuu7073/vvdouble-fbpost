/* VV DOUBLE · FB 貼文 · 直式 678×1028（2:3）文字排版，直接沿用 P1 的 15 個範本（P1 設計空間 1600×2048；本處以寬度等比縮放） */
var LAYOUT_W = 678, LAYOUT_H = 1028, P1_W = 1600;
var LAYOUT_FONTS = { YGUIB: 'YGUIB', YGM: 'YGM' };
var _uid = 1;
function L(o){ return Object.assign({ id:_uid++, t:'text', x:.5, y:.5, align:'center', font:'YGUIB', size:60, ls:.15, color:'#FFFFFF' }, o); }
var P1_TPLS = [
 {id:1, name:'1 經典置中', cat:'new', make:function(){ return [
   L({role:'tag', text:'#夏日繽紛色系', y:.398, size:54, ls:.28}),
   L({role:'title1', text:'繽紛色系',       y:.465, size:106, ls:.18}),
   L({role:'title2', text:'百搭圓領透膚上衣', y:.535, size:106, ls:.18}),
   L({role:'sub', text:'永遠不會嫌多的穿搭單品', y:.866, size:70, ls:.22}),
   L({role:'feats', text:'清涼透氣｜輕薄百搭｜不挑身型', y:.926, size:52, ls:.10})]; }},
 {id:2, name:'2 上標題・下賣點', cat:'new', make:function(){ return [
   L({role:'tag', text:'#夏日繽紛色系', y:.145, size:54, ls:.28}),
   L({role:'title', text:'百搭圓領透膚上衣', y:.205, size:96, ls:.18}),
   L({role:'feats', text:'清涼透氣｜輕薄百搭｜不挑身型', y:.925, size:52, ls:.10})]; }},
 {id:3, name:'3 機能框', cat:'new', make:function(){ return [
   L({role:'title', text:'涼感顯瘦寬褲', y:.455, size:100, ls:.20}),
   L({role:'pills', t:'pills', text:'涼感,透氣,舒適', y:.885, size:52, ls:.18, x:.5})]; }},
 {id:4, name:'4 數字規格', cat:'new', make:function(){ return [
   L({role:'specTop', text:'特製大尺碼鞋楦', y:.398, size:58, ls:.24}),
   L({role:'spec', text:'SIZE 38-45', y:.480, size:150, ls:.10, font:'YGUIB'}),
   L({role:'specSub', text:'寬楦不磨腳・久走不累', y:.565, size:54, ls:.18})]; }},
 {id:5, name:'5 側邊直書', cat:'new', make:function(){ return [
   L({role:'sub', t:'vtext', text:'永遠不會嫌多的穿搭單品', x:.915, y:.10, size:66, ls:.34, align:'left'}),
   L({role:'tag', text:'#獨家自訂', x:.075, y:.882, size:50, ls:.20, align:'left'}),
   L({role:'title', text:'輕薄百搭 不挑身型', x:.075, y:.940, size:58, ls:.16, align:'left'})]; }},
 {id:6, name:'6 Detail 細節標註', cat:'new', make:function(){ return [
   L({t:'utext', text:'Detail', x:.075, y:.822, size:56, ls:.28, align:'left', font:'YGUIB'}),
   L({role:'detail1', text:'領口包邊車線 不易鬆垮', x:.075, y:.895, size:54, ls:.14, align:'left'}),
   L({role:'detail2', text:'恰到好處的厚度 不透不悶', x:.075, y:.950, size:54, ls:.14, align:'left'})]; }},
 {id:7, name:'7 極簡一行', cat:'new', make:function(){ return [
   L({t:'line', x:.5, y:.905, size:2, ls:0, text:'112'}),
   L({role:'sub', text:'清涼透氣的日常百搭上衣', y:.945, size:60, ls:.26})]; }},
 {id:8, name:'8 上下框線置中', cat:'new', make:function(){ return [
   L({t:'line', x:.5, y:.418, size:2, ls:0, text:'900'}),
   L({role:'tag', text:'#獨家自訂', y:.462, size:52, ls:.26}),
   L({role:'title', text:'垂墜感顯瘦連身裙', y:.522, size:96, ls:.20}),
   L({t:'line', x:.5, y:.568, size:2, ls:0, text:'900'})]; }},
 {id:9, name:'9 底部白色資訊帶', cat:'new', make:function(){ return [
   L({t:'band', x:.5, y:1.0, size:240, text:'rgba(255,255,255,0.88)', ls:0}),
   L({role:'sub', text:'一件搞定的夏日穿搭', y:.917, size:62, ls:.22, color:'#3A3A3A'}),
   L({role:'feats', text:'遮肉顯瘦｜柔軟親膚｜機洗不變形', y:.965, size:50, ls:.08, color:'#6B6B6B'})]; }},
 {id:10, name:'10 大英文＋副標', cat:'new', make:function(){ return [
   L({role:'en', text:'NEW IN', y:.140, size:150, ls:.20, font:'YGUIB'}),
   L({role:'enSub', text:'本週新品搶先看', y:.215, size:60, ls:.24})]; }},
 {id:11, name:'11 引號口碑', cat:'new', make:function(){ return [
   L({text:'“', y:.395, size:150, ls:0, font:'YGUIB'}),
   L({role:'quote', text:'穿過一次就回不去了', y:.490, size:88, ls:.22}),
   L({role:'quoteSrc', text:'來自門市試穿的真實心得', y:.560, size:52, ls:.18})]; }},
 {id:12, name:'12 多色圓點', cat:'new', make:function(){ return [
   L({role:'title', text:'舒適滿分圓領短版T恤', y:.880, size:80, ls:.20}),
   L({t:'dots', x:.5, y:.940, size:26, ls:0, layout:'row', showNames:false, tail:'四色可選',
      colors:[{c:'#C9B6E4',n:'淺紫'},{c:'#F2E8DA',n:'奶茶'},{c:'#9FB4CC',n:'霧藍'},{c:'#4A4A4A',n:'經典黑'}]})]; }},
 {id:13, name:'13 側邊直排色點', cat:'new', make:function(){ return [
   L({t:'dots', x:.925, y:.50, size:26, ls:0, layout:'col', showNames:false, tail:'',
      colors:[{c:'#C9B6E4',n:'淺紫'},{c:'#F2E8DA',n:'奶茶'},{c:'#9FB4CC',n:'霧藍'},{c:'#4A4A4A',n:'經典黑'}]}),
   L({role:'tag', text:'#夏日繽紛色系', x:.075, y:.882, size:50, ls:.20, align:'left'}),
   L({role:'colorsLine', text:'一次收齊四色', x:.075, y:.942, size:68, ls:.18, align:'left'})]; }},
 {id:14, name:'14 布片色票', cat:'new', make:function(){ return [
   L({role:'title', text:'棉感寬鬆襯衫', y:.868, size:80, ls:.22}),
   L({t:'swatches', x:.5, y:.925, size:44, ls:0, showNames:true,
      colors:[{c:'#C9B6E4',n:'淺紫'},{c:'#F2E8DA',n:'奶茶'},{c:'#9FB4CC',n:'霧藍'}]})]; }},
  {id:15, name:'15 底邊色帶', cat:'new', make:function(){ return [
   L({role:'sub', text:'你的日常都能搭的顏色', y:.930, size:58, ls:.24}),
   L({t:'cband', x:.5, y:1.0, size:60, ls:0,
      colors:[{c:'#C9B6E4',n:''},{c:'#F2E8DA',n:''},{c:'#9FB4CC',n:''},{c:'#4A4A4A',n:''}]})]; }}
];
/* 各角色給 AI 的說明（字數＝中文字數上限） */
var LAYOUT_ROLES = {
  tag:'開頭 # 的主題標籤 例 #秋日微涼感 #獨家自訂', title:'商品短名 用商品名提煉 不含色名與《》前綴', title1:'商品短名前半（風格或系列）', title2:'商品短名後半（品項）',
  sub:'一句正面感受的賣點 有畫面', feats:'三個特點 用｜分隔 每個 2 到 4 字', pills:'三個關鍵字 用半形逗號分隔 每個 2 到 3 字',
  specTop:'規格的說明短句 例 一件剛好的長度', spec:'一個數字型規格 全大寫英文加數字 例 SIZE F-3L、LENGTH 92cm（依商品資料 沒有就寫尺寸範圍）', specSub:'規格帶來的好處一句',
  detail1:'細節描述一 版型或車工 例 腰內抽繩 鬆緊好調', detail2:'細節描述二 材質或穿著感受', en:'兩三個英文單字大寫 像雜誌標題 例 NEW IN、DAILY WEAR', enSub:'英文標題下的中文副標一句',
  quote:'一句像客人試穿後會說的話 口語 第一人稱', quoteSrc:'口碑來源一句 例 來自門市試穿的真實心得', colorsLine:'帶出顏色數量的一句 例 一次收齊三色'
};
var LAYOUT_MAX = { tag:10, title:10, title1:6, title2:8, sub:12, feats:16, pills:10, specTop:10, spec:14, specSub:12, detail1:12, detail2:12, en:16, enSub:10, quote:12, quoteSrc:12, colorsLine:10 };
/* 色名→色碼（Shopline 顏色名稱比對用，子字串比對，長詞優先） */
var COLOR_HEX = [['米白','#F3EEE4'],['象牙','#F4EFE3'],['奶油','#F7EFD8'],['奶茶','#D9C4A9'],['燕麥','#E3D9C6'],['杏','#EAD9C2'],['卡其','#C9B28A'],['駝','#C8A77A'],['焦糖','#B9793F'],['咖啡','#6B4A2B'],['可可','#7A5A48'],['深咖','#4E3728'],['摩卡','#8C6A54'],
 ['霧藍','#9FB4CC'],['淺藍','#B9D1E8'],['水藍','#A7CDE6'],['天藍','#8FBEE8'],['丹寧','#5F7FA8'],['牛仔','#5F7FA8'],['藏青','#2E3A5C'],['深藍','#2F3E6B'],['海軍','#2E3A5C'],['藍','#6A8FC7'],
 ['淺紫','#C9B6E4'],['薰衣草','#C9B6E4'],['芋','#B9A3CF'],['葡萄','#6E4F8A'],['紫','#8E7CC3'],
 ['淺粉','#F7CFDA'],['粉','#F2B6C6'],['玫瑰','#D98AA0'],['乾燥玫瑰','#C98B91'],['豆沙','#C98B91'],['桃','#F2A28C'],['珊瑚','#F0907A'],['磚紅','#B65A48'],['酒紅','#7A2334'],['紅','#C8373F'],
 ['鵝黃','#F6E3A3'],['淡黃','#F6E3A3'],['芥末','#C9A94F'],['黃','#F2D15F'],['橘','#F0A05A'],['橙','#F0A05A'],
 ['抹茶','#A7B98A'],['薄荷','#BFE3D3'],['淺綠','#BFDCB3'],['橄欖','#7D8A4E'],['軍綠','#5E6B45'],['墨綠','#2F4F43'],['森林綠','#355E4B'],['綠','#7FAF8A'],
 ['淺灰','#D9D9D9'],['灰','#9A9A9A'],['深灰','#5B5B5B'],['炭','#444444'],['鐵灰','#555A60'],['黑','#222222'],['白','#FFFFFF'],['銀','#C9CCD1'],['金','#D4B46A']];
function colorHex(name){ var n = String(name || ''); var best = null; COLOR_HEX.forEach(function(c){ if (n.indexOf(c[0]) >= 0 && (!best || c[0].length > best[0].length)) best = c; }); return best ? best[1] : '#CCCCCC'; }
var CN_NUM = ['零','一','兩','三','四','五','六','七','八','九','十'];
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
