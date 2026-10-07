export const MONSTERS = [
  {id:'emberpup',name:'ホムル',type:'ほのお',base:{hp:44,atk:18,def:12,spd:17},color:'#ff7a59',shape:'fox',moves:['ひっかき','ほのおのしずく'],evolve:{level:8,to:'emberwolf'}},
  {id:'emberwolf',name:'ホムガル',type:'ほのお',base:{hp:68,atk:29,def:20,spd:25},color:'#e8573f',shape:'wolf',moves:['かみつき','ほむらの牙']},
  {id:'mossling',name:'モスピ',type:'くさ',base:{hp:48,atk:15,def:17,spd:12},color:'#62c96f',shape:'bud',moves:['はっぱスパーク','つるパンチ'],evolve:{level:8,to:'mossbloom'}},
  {id:'mossbloom',name:'モスフロラ',type:'くさ',base:{hp:74,atk:25,def:29,spd:18},color:'#45a958',shape:'flower',moves:['つるのむち','森のこえ']},
  {id:'aquafluff',name:'ミズモフ',type:'みず',base:{hp:46,atk:15,def:14,spd:16},color:'#58b8ff',shape:'otter',moves:['みずしぶき','あわだま'],evolve:{level:8,to:'aquaflow'}},
  {id:'aquaflow',name:'ミズリオン',type:'みず',base:{hp:72,atk:27,def:24,spd:24},color:'#3893e6',shape:'otter',moves:['みずのうねり','潮かみ']},
  {id:'voltbit',name:'デンチュ',type:'でんき',base:{hp:40,atk:21,def:11,spd:24},color:'#ffd34d',shape:'mouse',moves:['でんきショック','ぱちぱち']},
  {id:'stonehorn',name:'ガンガ',type:'いわ',base:{hp:58,atk:22,def:25,spd:8},color:'#a89983',shape:'rhino',moves:['いわころがし','どしん']},
  {id:'skyfin',name:'ソラヒレ',type:'ひこう',base:{hp:42,atk:20,def:12,spd:28},color:'#9bd8ff',shape:'bird',moves:['つむじ風','つばさうち']},
  {id:'shadebud',name:'カゲミ',type:'かげ',base:{hp:45,atk:23,def:13,spd:20},color:'#8e78d8',shape:'cat',moves:['かげうち','くらやみ']},
  {id:'frostyak',name:'フロヤク',type:'こおり',base:{hp:65,atk:24,def:22,spd:10},color:'#b9f4ff',shape:'yak',moves:['こなゆき','ひょうざん']},
  {id:'starlingo',name:'ホシンゴ',type:'せいれい',base:{hp:52,atk:26,def:16,spd:22},color:'#e9b6ff',shape:'star',moves:['ほしつぶて','きらめき']}
];
export const TYPE_WEAK = {
  'ほのお':{'くさ':2,'みず':0.5,'いわ':0.5,'こおり':2},
  'くさ':{'みず':2,'ほのお':0.5,'ひこう':0.5,'こおり':0.5},
  'みず':{'ほのお':2,'いわ':2,'くさ':0.5,'でんき':0.5},
  'でんき':{'みず':2,'ひこう':2,'いわ':0.5},
  'いわ':{'ひこう':2,'ほのお':2,'こおり':2,'くさ':0.5,'みず':0.5},
  'ひこう':{'くさ':2,'いわ':0.5,'でんき':0.5},
  'かげ':{'せいれい':2},
  'せいれい':{'かげ':2}
};
export const AREAS = [
  {id:'meadow',name:'はじまりの原',level:2,encounters:['emberpup','mossling','aquafluff','voltbit'],boss:'stonehorn'},
  {id:'grove',name:'ひかりの森',level:5,encounters:['mossling','skyfin','shadebud','starlingo'],boss:'frostyak'},
  {id:'coast',name:'しおかぜ岬',level:8,encounters:['aquafluff','skyfin','voltbit','starlingo'],boss:'aquaflow'},
  {id:'canyon',name:'赤石の谷',level:11,encounters:['emberpup','stonehorn','shadebud','voltbit'],boss:'emberwolf'},
  {id:'ruins',name:'月影遺跡',level:14,encounters:['shadebud','starlingo','frostyak','skyfin'],boss:'starlingo'}
];
export const ITEMS={berry:{name:'みどり実',heal:25},orb:{name:'つかまえ球'}};
export const monsterById=id=>MONSTERS.find(m=>m.id===id);
export function stats(mon,level){const mult=1+(level-1)*0.085;return{hp:Math.floor(mon.base.hp*mult),atk:Math.floor(mon.base.atk*mult),def:Math.floor(mon.base.def*mult),spd:Math.floor(mon.base.spd*mult)}}
export function typeMultiplier(moveType,targetType){return TYPE_WEAK[moveType]?.[targetType]??1}