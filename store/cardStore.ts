import {create} from 'zustand';
import {cardRepository} from '@/db/repositories/cardRepository';
import type {Card,Deck,Rating,Review} from '@/features/cards/types';

type State={decks:Deck[];cards:Card[];reviews:Review[];loaded:boolean;load:()=>Promise<void>;createDeck:(name:string,color:string)=>Promise<Deck>;updateDeck:(id:string,name:string,color:string)=>Promise<void>;deleteDeck:(id:string,targetDeckId?:string|null)=>Promise<void>;createCard:(deckId:string,front:string,back:string,sourceNoteId?:string|null)=>Promise<void>;createMany:(deckId:string,items:{front:string;back:string}[])=>Promise<number>;updateCard:(id:string,front:string,back:string,deckId:string)=>Promise<void>;deleteCard:(id:string)=>Promise<void>;rate:(id:string,rating:Rating)=>Promise<Card>};
export const useCardStore=create<State>((set,get)=>({
 decks:[],cards:[],reviews:[],loaded:false,
 load:async()=>{const data=await cardRepository.all();set({...data,loaded:true})},
 createDeck:async(name,color)=>{const item=await cardRepository.createDeck(name,color);set(s=>({decks:[...s.decks,item]}));return item},
 updateDeck:async(id,name,color)=>{await cardRepository.updateDeck(id,name,color);set(s=>({decks:s.decks.map(d=>d.id===id?{...d,name,color}:d)}))},
 deleteDeck:async(id,targetDeckId=null)=>{await cardRepository.deleteDeck(id,targetDeckId);set(s=>{const removedIds=new Set(s.cards.filter(c=>c.deckId===id).map(c=>c.id));return {decks:s.decks.filter(d=>d.id!==id),cards:targetDeckId===null?s.cards.filter(c=>c.deckId!==id):s.cards.map(c=>c.deckId===id?{...c,deckId:targetDeckId}:c),reviews:targetDeckId===null?s.reviews.filter(r=>!removedIds.has(r.cardId)):s.reviews}})},
 createCard:async(deckId,front,back,sourceNoteId=null)=>{const item=await cardRepository.createCard(deckId,front,back,sourceNoteId);set(s=>({cards:[...s.cards,item]}))},
 createMany:async(deckId,items)=>{const created=await cardRepository.createMany(deckId,items);set(s=>({cards:[...s.cards,...created]}));return created.length},
 updateCard:async(id,front,back,deckId)=>{await cardRepository.updateCard(id,front,back,deckId);set(s=>({cards:s.cards.map(c=>c.id===id?{...c,front,back,deckId}:c)}))},
 deleteCard:async id=>{await cardRepository.deleteCard(id);set(s=>({cards:s.cards.filter(c=>c.id!==id),reviews:s.reviews.filter(r=>r.cardId!==id)}))},
 rate:async(id,rating)=>{const current=get().cards.find(c=>c.id===id);if(!current)throw Error('Kart bulunamadı');const {next,entry}=await cardRepository.rate(current,rating);set(s=>({cards:s.cards.map(c=>c.id===id?next:c),reviews:[...s.reviews,entry]}));return next},
}));
