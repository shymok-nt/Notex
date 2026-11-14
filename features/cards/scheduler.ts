import type {Card,Rating,Review} from './types';

export const localDay=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const addLocalDays=(date:Date,days:number)=>{const next=new Date(date.getFullYear(),date.getMonth(),date.getDate());next.setDate(next.getDate()+days);return localDay(next)};
export const nextReview=(card:Card,rating:Rating,now=new Date())=>{
 const ease=Math.max(1.3,card.ease+(rating==='again'?-0.2:rating==='hard'?-0.15:rating==='easy'?0.15:0));
 const repetitions=rating==='again'?0:card.repetitions+1;
 const interval=rating==='again'?1:rating==='hard'?Math.max(1,Math.round(Math.max(1,card.interval)*1.2)):rating==='easy'?Math.max(4,Math.round(Math.max(1,card.interval)*ease*1.3)):card.repetitions===0?1:card.repetitions===1?6:Math.max(1,Math.round(card.interval*ease));
 return {...card,ease,interval,repetitions,dueDate:rating==='again'?localDay(now):addLocalDays(now,interval),lastReviewed:now.toISOString()};
};
export const intervalLabel=(days:number)=>days===0?'Bugün tekrar':days===1?'1 gün':`${days} gün`;
export const dueCards=(cards:Card[],today=localDay(new Date()),newLimit=20)=>{
 const due=cards.filter(c=>c.lastReviewed!==null&&c.dueDate<=today);
 const fresh=cards.filter(c=>c.lastReviewed===null).slice(0,Math.max(0,newLimit));
 return [...due,...fresh];
};
export const remainingNewLimit=(reviews:Review[],limit:number,today=localDay(new Date()))=>{
 const first=new Map<string,string>();for(const review of reviews){const day=localDay(new Date(review.reviewedAt));const prior=first.get(review.cardId);if(prior===undefined||day<prior)first.set(review.cardId,day)}
 return Math.max(0,limit-[...first.values()].filter(day=>day===today).length);
};
