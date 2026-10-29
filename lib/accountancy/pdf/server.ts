import 'server-only';
import {notFound} from 'next/navigation';
import {createClient} from '@supabase/supabase-js';
import {requireEstateAdmin} from '../../security/estate-properties';
import {pdfIntakeEnvironment} from './model';
import {scannerIsExplicitlyEnabled} from '../../property-operations/scanner/cloudmersive-advanced';
export const scannerOptions=()=>({environment:process.env.VERCEL_ENV,supabaseUrl:process.env.NEXT_PUBLIC_SUPABASE_URL,enabled:process.env.MZS_OPS_AV_SCAN_ENABLED,processorApproved:process.env.MZS_OPS_AV_PROCESSOR_APPROVED,apiKey:process.env.MZS_OPS_CLOUDMERSIVE_API_KEY});
export function pdfProcessingReady(){return pdfIntakeEnvironment()&&scannerIsExplicitlyEnabled(scannerOptions())&&Boolean(process.env.MZS_OPS_STAGING_SCANNER_SERVICE_ROLE_KEY);}
export async function requirePdfAdmin(){if(!pdfIntakeEnvironment())notFound();return requireEstateAdmin();}
export function processingClient(){if(!pdfProcessingReady())throw Error('PDF processing is not configured');return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.MZS_OPS_STAGING_SCANNER_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});}
