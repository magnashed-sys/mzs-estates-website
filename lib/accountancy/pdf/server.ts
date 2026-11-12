import 'server-only';
import {notFound} from 'next/navigation';
import {createClient} from '@supabase/supabase-js';
import {requireEstateAdmin} from '../../security/estate-properties';
import {pdfIntakeEnvironment} from './model';
import {scannerIsExplicitlyEnabled} from '../../property-operations/scanner/cloudmersive-advanced';
export const scannerOptions=()=>({environment:process.env.VERCEL_ENV,supabaseUrl:process.env.NEXT_PUBLIC_SUPABASE_URL,enabled:process.env.MZS_OPS_AV_SCAN_ENABLED,processorApproved:process.env.MZS_OPS_AV_PROCESSOR_APPROVED,apiKey:process.env.MZS_OPS_CLOUDMERSIVE_API_KEY,apiBaseUrl:process.env.MZS_OPS_CLOUDMERSIVE_BASE_URL,region:process.env.MZS_OPS_AV_REGION,productionReady:process.env.MZS_PURCHASE_PDF_PRODUCTION_READY});
const serviceKey=()=>process.env.VERCEL_ENV==='production'?process.env.MZS_PURCHASE_SCANNER_SERVICE_ROLE_KEY:process.env.MZS_OPS_STAGING_SCANNER_SERVICE_ROLE_KEY;
export function pdfProcessingReady(){return pdfIntakeEnvironment()&&scannerIsExplicitlyEnabled(scannerOptions())&&Boolean(serviceKey());}
export async function requirePdfAdmin(){if(!pdfIntakeEnvironment())notFound();return requireEstateAdmin();}
export function processingClient(){if(!pdfProcessingReady())throw Error('PDF processing is not configured');return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,serviceKey()!,{auth:{persistSession:false,autoRefreshToken:false}});}
