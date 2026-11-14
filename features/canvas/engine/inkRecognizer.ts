/** Ink Engine / Phase 3: explicit recognition contract.
 *
 * No model is shipped or activated yet. A Windows recognizer or a validated
 * ONNX model must be implemented and tested before this returns text.
 * Never silently fall back to the old PaddleOCR worker.
 */
import type {InkLine,InkPoint} from './inkPreprocessor';

export type InkCandidate={text:string;confidence?:number};
export type InkRecognitionResult=
 |{status:'recognized';engine:string;candidates:InkCandidate[]}
 |{status:'unavailable';reason:string}
 |{status:'unrecognized';engine:string;reason:string};

export type InkRecognitionInput={
 locale:'tr-TR';
 strokes:{id:string;points:InkPoint[]}[];
};

export interface InkRecognizer{
 readonly id:string;
 readonly supportsOffline:boolean;
 recognize(input:InkRecognitionInput):Promise<InkRecognitionResult>;
}

/** A deliberately inactive implementation, not a mock recognizer. */
export const unavailableInkRecognizer:InkRecognizer={
 id:'not-configured',
 supportsOffline:true,
 async recognize():Promise<InkRecognitionResult>{
  return {status:'unavailable',reason:'Türkçe Windows el yazısı tanıyıcısı veya doğrulanmış ONNX modeli henüz entegre edilmedi.'};
 }
};

export function inputFromInkLine(line:InkLine):InkRecognitionInput{
 return {
  locale:'tr-TR',
  strokes:line.strokes.map(stroke=>({
   id:stroke.id,
   points:stroke.points.map(point=>({...point}))
  }))
 };
}
