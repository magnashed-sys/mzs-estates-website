export const ownerReportRecipient='magdy@mzsgroup.eu';
export const ownerReportFrom='MZS Group <info@mzsgroup.eu>';
const escapeHtml=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
export function ownerReportMessage(subject:string,body:string){
 if(!subject.trim()||subject.length>180||/[\r\n]/.test(subject)||!body.trim()||body.length>60000)throw Error('Invalid report');
 // Plain text is the source of truth. Only explicit HTTPS URLs become links.
 const htmlBody=body.split(/(https:\/\/[^\s<>"']+)/g).map((part,index)=>{
  if(index%2===0)return escapeHtml(part);
  try {const url=new URL(part);if(url.protocol==='https:'&&!url.username&&!url.password)return `<a style="color:#897044" href="${escapeHtml(url.href)}">${escapeHtml(part)}</a>`;}catch{/* Render invalid URL as text. */}
  return escapeHtml(part);
 }).join('').replace(/\r?\n/g,'<br>');
 const footer='Dit is een geautomatiseerd bericht van MZS Group. Neem bij vragen contact op met je relatiemanager.';
 return {subject,text:`${body}\n\nMZS Group\n${footer}`,html:`<!doctype html><html lang="nl"><body style="margin:0;background:#f4f1eb;font-family:Arial,sans-serif;color:#25231e"><div style="max-width:720px;margin:24px auto;padding:28px;background:#fff"><p style="color:#897044;letter-spacing:4px">MZS GROUP</p><h1 style="font-size:25px">${escapeHtml(subject)}</h1><div style="font-size:15px;line-height:1.7;overflow-wrap:anywhere">${htmlBody}</div><hr style="border:0;border-top:1px solid #d5c09a;margin:28px 0"><p>MZS Group</p><p style="font-size:12px;color:#666;line-height:1.6">${footer}</p><p style="font-size:10px;color:#897044;letter-spacing:2px">PRIVATE · INDEPENDENT · INTERNATIONAL</p></div></body></html>`};
}
