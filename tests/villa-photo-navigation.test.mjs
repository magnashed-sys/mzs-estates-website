import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {createTranslator} from 'next-intl';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.join(root, 'app/private/projects/[slug]');

function walkthrough(initialLocale = 'nl') {
  let locale = initialLocale, state, dirty, effectDeps, cleanup, pendingEffect, tree, refIndex;
  const refs = [], scrolls = [], listeners = new Map();
  const window = {
    location: {hash: ''},
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name, callback) => {if (listeners.get(name) === callback) listeners.delete(name);},
  };
  const react = {
    useState: initial => {
      state ??= initial;
      return [state, value => {state = typeof value === 'function' ? value(state) : value; dirty = true;}];
    },
    useRef: initial => {const index = refIndex++; return refs[index] ??= {current: initial};},
    useEffect: (callback, deps) => {
      if (JSON.stringify(deps) !== JSON.stringify(effectDeps)) {pendingEffect = callback; effectDeps = deps;}
    },
  };
  const jsx = (type, props, key) => ({type, props: props || {}, key});
  const translator = () => createTranslator({locale, messages: JSON.parse(fs.readFileSync(path.join(root, 'messages', locale + '.json'))), namespace: 'ProjectUI', onError: error => {throw error;}});
  function load(file) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}}).outputText;
    new Function('exports', 'require', 'window', code)(exports, name => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return {jsx, jsxs: jsx, Fragment: 'fragment'};
      if (name === 'next-intl') return {useLocale: () => locale, useTranslations: translator};
      if (name === 'next/image') return {default: 'img'};
      if (name.endsWith('.css')) return {default: new Proxy({}, {get: (_, key) => key})};
      if (name.endsWith('ArrowUpRightIcon')) return {default: 'arrow-icon'};
      const resolved = path.resolve(path.dirname(file), name);
      if (name.endsWith('.json')) return {default: JSON.parse(fs.readFileSync(resolved, 'utf8'))};
      return load(['.ts', '.tsx'].map(extension => resolved + extension).find(fs.existsSync));
    }, window);
    return exports;
  }
  function nodes(node, result = []) {
    if (Array.isArray(node)) {node.forEach(child => nodes(child, result)); return result;}
    if (!node || typeof node !== 'object') return result;
    result.push(node); nodes(node.props.children, result); return result;
  }
  const Component = load(path.join(directory, 'PropertyWalkthrough.tsx')).default;
  function render() {
    for (let attempt = 0; attempt < 5; attempt++) {
      refIndex = 0; dirty = false; tree = Component();
      for (const node of nodes(tree)) if (node.props.ref) node.props.ref.current = {scrollIntoView: options => scrolls.push({id: node.props.id, ...options})};
      if (pendingEffect) {cleanup?.(); const next = pendingEffect; pendingEffect = undefined; cleanup = next();}
      if (!dirty) return tree;
    }
    throw Error('Render did not settle');
  }
  function find(predicate) {const node = nodes(tree).find(predicate); assert.ok(node, 'Expected element'); return node;}
  render();
  return {
    nodes: () => nodes(tree), find, render, scrolls,
    map: id => {listeners.get('mzs-photo-chapter')({detail: id}); render();},
    hash: id => {window.location.hash = '#tour-' + id; listeners.get('hashchange')(); render();},
    language: value => {locale = value; render();},
    displayed: () => find(node => node.type === 'img' && node.props.className === 'image').props.src,
    move: key => {find(node => node.type === 'button' && node.props['aria-label'] === translator()(key)).props.onClick(); render();},
  };
}

test('Every La Nucia chapter link targets the photo top and chapter buttons scroll the same canvas', () => {
  for (const locale of ['nl', 'en', 'ar']) {
    const ui = walkthrough(locale);
    const canvas = ui.find(node => node.props.id === 'tour-photo');
    const anchors = canvas.props.children.flat().filter(node => node?.props?.className === 'chapterAnchor');
    const buttons = ui.nodes().filter(node => node.type === 'button' && node.props['aria-controls'] === 'tour-photo');
    assert.equal(anchors.length, buttons.length);
    assert.ok(buttons.length >= 10);
    for (const button of buttons) {
      assert.equal(button.props.id, undefined, 'Native fragment scrolling must not target a lower menu row');
      button.props.onClick(); ui.render();
      assert.deepEqual(ui.scrolls.at(-1), {id: 'tour-photo', block: 'start', inline: 'nearest'});
      const anchor = anchors.find(item => item.props.id === 'tour-' + button.key);
      assert.ok(anchor, 'Each chapter keeps its existing deep link at the photo top');
      ui.hash(button.key);
      assert.equal(ui.find(node => node.type === 'button' && node.props['aria-current'] === 'step').key, button.key);
    }
  }
});

test('Dutch roof terrace follows the rear guest room, includes three photos, and preserves locale navigation', () => {
  const ui = walkthrough();
  const chapters = ui.nodes().filter(node => node.type === 'button' && node.props['aria-controls'] === 'tour-photo').map(node => node.key);
  assert.equal(chapters[chapters.indexOf('guest-green') + 1], 'rooftop');
  ui.map('rooftop'); assert.ok(ui.displayed().endsWith('/roof-terrace.webp'));
  ui.move('p150'); assert.ok(ui.displayed().endsWith('/roof-access.webp'));
  const canvas = ui.find(node => node.props.id === 'tour-photo');
  canvas.props.onTouchStart({touches: [{clientX: 120, clientY: 10}]});
  canvas.props.onTouchEnd({changedTouches: [{clientX: 10, clientY: 12}]}); ui.render();
  assert.ok(ui.displayed().endsWith('/roof-view.webp'));
  ui.move('p150'); assert.equal(ui.find(node => node.props['aria-current'] === 'step').key, 'outdoor');
  ui.hash('rooftop'); ui.language('en');
  assert.equal(ui.find(node => node.props['aria-current'] === 'step').key, 'pool');
  assert.ok(!ui.nodes().some(node => node.props.id === 'tour-rooftop'));
  ui.map('laundry'); assert.ok(ui.displayed().endsWith('/laundry.webp'));
  ui.map('rooftop'); assert.ok(ui.displayed().endsWith('/laundry.webp'));
});
