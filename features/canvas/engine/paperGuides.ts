export const PAPER_GUIDE_SPACING=80;
export const PAPER_GUIDE_LINE_WIDTH=0.75;
export type PaperGuideMetrics={stepPage:number;firstLinePage:number;lineWidth:number};

/** Mirrors StaticPaper's device-pixel aligned ruled/grid spacing in page units. */
export function getPaperGuideMetrics(fitWidth:number,pixelRatio:number):PaperGuideMetrics{
 const safeFit=Math.max(Number.EPSILON,fitWidth),safeRatio=Math.max(Number.EPSILON,pixelRatio);
 const stepPx=Math.max(8,Math.round(PAPER_GUIDE_SPACING*safeFit*safeRatio));
 const linePx=Math.max(1,Math.round(safeRatio*PAPER_GUIDE_LINE_WIDTH));
 const stepPage=stepPx/safeRatio/safeFit;
 const half=linePx%2?0.5/safeRatio/safeFit:0;
 return {stepPage,firstLinePage:stepPage+half,lineWidth:linePx/safeRatio/safeFit};
}

/** Returns the nearest actual guide only when the handwriting baseline is close enough. */
export function nearestPaperGuide(baseline:number,metrics:PaperGuideMetrics,tolerance:number){
 if(!Number.isFinite(baseline)||!Number.isFinite(tolerance)||tolerance<0||metrics.stepPage<=0)return null;
 const row=Math.round((baseline-metrics.firstLinePage)/metrics.stepPage);
 if(row<0)return null;
 const guide=metrics.firstLinePage+row*metrics.stepPage;
 const distance=Math.abs(guide-baseline);
 return distance<=tolerance?{baseline:guide,row,distance}:null;
}
