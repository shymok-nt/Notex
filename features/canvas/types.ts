export const PAGE_WIDTH=1000;
export const PAGE_HEIGHT=1414;
export type Point=[number,number,number];
export type Bounds=[number,number,number,number];
export type TextFontFamily='Inter'|'SpaceGrotesk';
export type StrokeElement={id:string;type:'stroke';renderMode?:'centerline'|'raw'|'outline';z:number;createdAt:string;tool:'pen'|'highlighter';color:string;width:number;opacity:number;points:number[];bbox:Bounds};
export type ShapeKind='line'|'arrow'|'rect'|'ellipse'|'triangle'|'polygon';
export type ShapeMode=ShapeKind|'auto';
export type ShapeElement={id:string;type:'shape';z:number;createdAt:string;kind:ShapeKind;params:{x:number;y:number;w:number;h:number;rotation:number;points?:number[]};stroke:{color:string;width:number;opacity:number};fill:null|{color:string;opacity:number};bbox:Bounds};
// Legacy recognition metadata remains part of the stored shape so old notes and
// backups round-trip without losing their original stroke recovery data.
export type TextElement={id:string;type:'text';z:number;createdAt:string;x:number;y:number;w:number;text:string;fontSize:number;color:string;bold:boolean;align:'left'|'center'|'right';fontFamily?:TextFontFamily;minHeight?:number;erasures?:{points:number[];radius:number}[];recognitionSourceStrokes?:StrokeElement[];recognitionManuallyEdited?:boolean;bbox:Bounds};
export type Element=StrokeElement|ShapeElement|TextElement;
export type PageImage={id:string;uri:string;x:number;y:number;width:number;height:number;rotation?:number};
export type HandwritingFont='Caveat'|'PatrickHand'|'DancingScript'|'Kalam';
export type BeautifiedWord={id:string;text:string;bbox:Bounds;baseline:number;fontSize:number;color:string;font:'Inter'|'InterBold'|HandwritingFont};
export type Beautification={sourceIds:string[];words:BeautifiedWord[];mode:'original'|'beautified'};
export type PageContent={v:2;elements:Element[];images?:PageImage[];backgroundImage?:PageImage;h?:number;beautifications?:Beautification[]};
export const emptyContent=():PageContent=>({v:2,elements:[]});
