import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/security/intro-call-preview.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

test('introductory call prototype is restricted to Preview with the isolated Staging project', () => {
  const staging = 'https://senonkpxdtlhyhrubicg.supabase.co';
  for (const VERCEL_ENV of ['preview', 'production', 'development', undefined]) {
    for (const NEXT_PUBLIC_SUPABASE_URL of [staging, 'https://ptrnjzmcehrhbsfxntgw.supabase.co', 'https://wrong.invalid', undefined]) {
      const exports = {};
      vm.runInNewContext(js, { exports, process: { env: { VERCEL_ENV, NEXT_PUBLIC_SUPABASE_URL } } });
      assert.equal(exports.isIntroCallPreviewEnabled(), VERCEL_ENV === 'preview' && NEXT_PUBLIC_SUPABASE_URL === staging);
    }
  }
});
