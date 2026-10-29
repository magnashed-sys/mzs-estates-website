import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const read=(path)=>readFileSync(path,'utf8');

test('property manager landing shows MZS wordmark and Property Manager without client back navigation',()=>{
 const page=read('app/staff/page.tsx');
 assert.match(page,/<header className=\{s\.managerBrandHeader\}>/);
 assert.match(page,/className=\{s\.managerLogo\} aria-label="MZS Group"/);
 assert.match(page,/className=\{s\.managerMonogram\}>MZS<\/span>/);
 assert.match(page,/className=\{s\.managerGroupLabel\}>GROUP<\/span>/);
 assert.match(page,/<h1 className=\{s\.managerBrandTitle\}>Property Manager<\/h1>/);
 assert.doesNotMatch(page,/Mijn omgeving|href="\/private"/);
 assert.match(page,/requirePropertyStaff\(\)/);
});

test('My tasks keeps its operational controls but drops the redundant upper label',()=>{
 const board=read('app/staff/StaffTaskBoard.tsx');
 assert.match(board,/<h2 id="staff-tasks-title">\{t\('tasks'\)\}<\/h2>/);
 assert.doesNotMatch(board,/MY PROPERTY MANAGEMENT/);
 assert.match(board,/taskOverview\(tasks,today\)/);
 assert.match(board,/NewWorkItem/);
 assert.match(board,/t\('logTime'\)/);
});

test('brand header is mobile-friendly and not globally changing admin pages',()=>{
 const css=read('app/staff/staff.module.css');
 assert.match(css,/\.staffLanding\{/);
 assert.match(css,/\.managerBrandHeader\{/);
 assert.match(css,/\.managerMonogram\{/);
 assert.match(css,/\.managerBrandTitle\{/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(css,/\.managerBrandHeader\{gap:12px/);
});
