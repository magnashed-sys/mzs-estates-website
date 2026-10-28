import sharp from 'sharp';
export const MAX_PHOTO_BYTES=4*1024*1024;
/** Decode allowlisted raster formats and create a new JPEG; EXIF/GPS and trailing payloads are never copied. */
export async function normalizeMaintenancePhoto(bytes:Uint8Array):Promise<Buffer>{
 if(bytes.length<1||bytes.length>MAX_PHOTO_BYTES)throw Error('Foto moet kleiner zijn dan 4 MB.');
 const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
 const webp=bytes.length>=12&&Buffer.from(bytes.subarray(0,4)).toString()==='RIFF'&&Buffer.from(bytes.subarray(8,12)).toString()==='WEBP';
 if(!jpeg&&!png&&!webp)throw Error('Gebruik een JPEG-, PNG- of WebP-foto.');
 const image=sharp(bytes,{limitInputPixels:20_000_000,failOn:'warning'});
 const metadata=await image.metadata();
 if(!metadata.format||!['jpeg','png','webp'].includes(metadata.format)||(metadata.pages??1)!==1)throw Error('Alleen één stilstaand beeld per foto.');
 const clean=await image.rotate().resize({width:2560,height:2560,fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'}).jpeg({quality:85}).toBuffer();
 if(clean.length>MAX_PHOTO_BYTES)throw Error('Verklein deze foto en probeer opnieuw.');
 return clean;
}
