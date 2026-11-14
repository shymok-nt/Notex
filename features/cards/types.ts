export type Deck={id:string;name:string;color:string;createdAt:string};
export type Card={id:string;deckId:string;front:string;back:string;sourceNoteId:string|null;createdAt:string;ease:number;interval:number;repetitions:number;dueDate:string;lastReviewed:string|null};
export type Rating='again'|'hard'|'good'|'easy';
export type Review={id:string;cardId:string;rating:Rating;reviewedAt:string};
