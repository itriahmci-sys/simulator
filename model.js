// Educational scenario model. All coefficients are illustrative, not Taiwan evidence.
export const DEFAULTS = Object.freeze({ n:60, procurement:60, it:65, admin:50, standard:45, diversity:60, exceptions:true, cash:75, purchaseBase:80000, itBase:18000, adminBase:80000, otherBase:300000, hoursBase:120, fixedBase:180000, setupBase:1200000, months:24, targetFee:22000 });
export const LIMITS = { n:[1,200,1], procurement:[0,100,1], it:[0,100,1], admin:[0,100,1], standard:[0,100,1], diversity:[0,100,1], cash:[0,100,1], purchaseBase:[0,500000,1000], itBase:[0,200000,1000], adminBase:[0,500000,1000], otherBase:[0,2000000,1000], hoursBase:[0,500,1], fixedBase:[0,2000000,1000], setupBase:[0,20000000,10000], months:[1,60,1], targetFee:[0,200000,1000] };
export const PRESETS = {
  pilot: { ...DEFAULTS, n:12, procurement:35, it:40, admin:25, standard:25 },
  balanced: { ...DEFAULTS },
  integrated: { ...DEFAULTS, n:100, procurement:90, it:90, admin:85, standard:85, exceptions:false }
};
export function normalize(input={}) {
  const out={...DEFAULTS};
  for (const [key,[min,max,step]] of Object.entries(LIMITS)) {
    const v=Number(input[key] ?? out[key]);
    out[key]=Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v/step)*step)) : out[key];
  }
  if(typeof input.exceptions==='boolean') out.exceptions=input.exceptions;
  return out;
}
export function calculate(input) {
  const v=normalize(input), n=v.n, p=v.procurement/100, t=v.it/100, a=v.admin/100, s=v.standard/100, d=v.diversity/100, r=v.cash/100, e=v.exceptions?1:0;
  const scale=1-Math.exp(-(n-1)/40);
  const purchaseSaving=v.purchaseBase*p*.18*scale;
  const itSaving=v.itBase*t*(.30+.25*scale);
  const adminSaving=v.adminBase*a*(.30+.40*s)*r;
  const grossSaving=purchaseSaving+itSaving+adminSaving;
  const fixed=v.fixedBase+120000*p+160000*t+180000*a+100000*s;
  const exceptionCost=2800*a*s*d*(e?1:.4);
  const adaptationCost=3000*t*d*(1-s);
  const variablePer=1500*p+2200*t+5500*a+1200*s+exceptionCost+adaptationCost;
  const variable=variablePer*n;
  const startup=v.setupBase+n*30000*(a+t+s)/3;
  const amortization=startup/v.months;
  const budget=fixed+variable+amortization;
  const fee=budget/n;
  const baseline=v.purchaseBase+v.itBase+v.adminBase+v.otherBase;
  const retained=baseline-grossSaving;
  const combined=retained+fee;
  const netSaving=baseline-combined;
  const income=v.targetFee*n;
  const balance=income-budget;
  const releasedHours=Math.max(0, v.hoursBase*((.42*a+.18*t+.18*s)*(1-.30*d*(1-s))-.06*a*s*d-.02*e*a*s*d));
  const centerHours=80+240*(p+t+a)/3+n*(a*55*(1-.35*s)+t*10+p*5+d*s*a*8);
  const networkHoursBefore=n*v.hoursBase;
  const networkHoursAfter=n*(v.hoursBase-releasedHours)+centerHours;
  const networkHoursSaved=networkHoursBefore-networkHoursAfter;
  const flexibility=Math.min(100, Math.max(0,100-(45*s+15*a+8*t)*(1+.25*d)+18*e*s));
  const coordination=Math.min(100,Math.max(0,10+40*s*d+20*a+15*t+10*Math.sqrt(n/200)+6*e*s));
  return {v,scale,purchaseSaving,itSaving,adminSaving,grossSaving,fixed,exceptionCost,adaptationCost,variablePer,variable,startup,amortization,budget,fee,baseline,retained,combined,netSaving,income,balance,releasedHours,centerHours,networkHoursBefore,networkHoursAfter,networkHoursSaved,flexibility,coordination};
}
export function findThreshold(input) {
  for(let n=1;n<=200;n++) if(calculate({...input,n}).netSaving>=0) return n;
  return null;
}
