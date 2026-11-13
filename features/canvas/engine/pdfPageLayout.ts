export function pdfPageLayout(width:number,height:number,pageWidth:number,pageMinimumHeight:number){
 if(![width,height,pageWidth,pageMinimumHeight].every(Number.isFinite)||width<=0||height<=0||pageWidth<=0||pageMinimumHeight<=0)throw new Error('PDF sayfa boyutları geçersiz.');
 const imageWidth=pageWidth;
 const imageHeight=imageWidth*height/width;
 if(!Number.isFinite(imageHeight)||imageHeight>1_000_000)throw new Error('Bu PDF sayfasının oranı Notex sayfa sınırlarını aşıyor.');
 const pageHeight=Math.max(pageMinimumHeight,imageHeight);
 return {x:0,y:(pageHeight-imageHeight)/2,width:imageWidth,height:imageHeight,pageHeight};
}
