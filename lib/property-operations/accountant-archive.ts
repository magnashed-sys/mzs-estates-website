import {createHash} from "node:crypto";
import {deflateRawSync} from "node:zlib";

export type ArchiveFile={name:string;bytes:Uint8Array};
const encoder=new TextEncoder();
const CAP=24*1024*1024;
const checksum=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
type ZipLimits={maxFiles:number;maxBytes:number};
const defaults:ZipLimits={maxFiles:150,maxBytes:CAP};

/** ZIP32 archive with fixed DOS timestamps and bounded deflate. No zip-slip names. */
export function buildAccountantZip(files:readonly ArchiveFile[]):Uint8Array {
 return new Uint8Array(Buffer.concat(prepareZip(files,defaults)));
}

/** Validate and compress everything before starting a download. Stream bounded chunks
 * so a private annual package can exceed the hosting buffered-response limit. */
export function accountantZipStream(files:readonly ArchiveFile[],limits:ZipLimits):ReadableStream<Uint8Array>{
 const parts=prepareZip(files,limits);
 let index=0,offset=0;
 return new ReadableStream<Uint8Array>({
  pull(controller){
   if(index===parts.length){parts.length=0;controller.close();return;}
   const part=parts[index],end=Math.min(part.length,offset+64*1024);
   controller.enqueue(new Uint8Array(part.buffer,part.byteOffset+offset,end-offset));
   offset=end;
   if(offset===part.length){parts[index]=Buffer.alloc(0);index++;offset=0;}
  },
  cancel(){parts.length=0;}
 });
}

function prepareZip(files:readonly ArchiveFile[],limits:ZipLimits):Buffer[]{
 if(!Number.isSafeInteger(limits.maxFiles)||limits.maxFiles<1||limits.maxFiles>1024||
  !Number.isSafeInteger(limits.maxBytes)||limits.maxBytes<1||limits.maxBytes>128*1024*1024)
  throw new Error("Invalid export limits");
 if(!Array.isArray(files)||files.length<1||files.length>limits.maxFiles)
  throw new Error("Invalid export file count");
 const seen=new Set<string>(),parts:Buffer[]=[],central:Buffer[]=[];
 let cursor=0,uncompressedTotal=0;
 for(const item of files){
  const name=item?.name;
  if(typeof name!=="string"||name.length>180||!name ||
    !/^[A-Za-z0-9][A-Za-z0-9._\/-]*$/.test(name)||name.includes("..")||
    name.includes("//")||name.startsWith("/")||name.endsWith("/")||seen.has(name))
   throw new Error("Unsafe or duplicate archive path");
  seen.add(name);
  if(!(item.bytes instanceof Uint8Array) || item.bytes.length>limits.maxBytes)
   throw new Error("Invalid export file bytes");
  uncompressedTotal+=item.bytes.length;
  if(uncompressedTotal>limits.maxBytes)throw new Error("Accountant export exceeds the size limit");
  const contents=Buffer.from(item.bytes);
  const compressed=deflateRawSync(contents,{level:6});
  const nameBytes=Buffer.from(name,"utf8");
  if(nameBytes.length>65535||compressed.length>0xffffffff||contents.length>0xffffffff)
   throw new Error("ZIP32 file overflow");
  let crc=0xffffffff;
  for(const b of contents){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^(crc&1?0xedb88320:0);}
  crc=(crc^0xffffffff)>>>0;
  const local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);
  local.writeUInt16LE(0x0800,6);local.writeUInt16LE(8,8);
  local.writeUInt16LE(0,10);local.writeUInt16LE(33,12);
  local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);
  local.writeUInt32LE(contents.length,22);local.writeUInt16LE(nameBytes.length,26);
  local.writeUInt16LE(0,28);
  const cd=Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50,0);
  cd.writeUInt16LE(20,4);cd.writeUInt16LE(20,6);
  cd.writeUInt16LE(0x0800,8);cd.writeUInt16LE(8,10);
  cd.writeUInt16LE(0,12);cd.writeUInt16LE(33,14);
  cd.writeUInt32LE(crc,16);cd.writeUInt32LE(compressed.length,20);
  cd.writeUInt32LE(contents.length,24);cd.writeUInt16LE(nameBytes.length,28);
  cd.writeUInt32LE(0,30);cd.writeUInt32LE(0,34);cd.writeUInt32LE(0,38);
  cd.writeUInt32LE(cursor,42);
  parts.push(local,nameBytes,compressed);
  central.push(cd,nameBytes);
  cursor+=local.length+nameBytes.length+compressed.length;
 }
 const centralSize=central.reduce((sum,p)=>sum+p.length,0);
 const end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);
 end.writeUInt16LE(0,4);end.writeUInt16LE(0,6);
 end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);
 end.writeUInt32LE(centralSize,12);end.writeUInt32LE(cursor,16);
 end.writeUInt16LE(0,20);
 return [...parts,...central,end];
}
export function exportHash(contents:Uint8Array):string{return checksum(contents);}
export function exportBytes(content:string):Uint8Array{return encoder.encode(content);}
