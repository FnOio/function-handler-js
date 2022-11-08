import { expect } from 'chai';
import { FunctionHandler } from './FunctionHandler';
import { } from 'mocha';
import { JavaScriptHandler } from './handlers/JavaScriptHandler';
import prefixes from './prefixes';
import * as fs from 'fs';
import * as path from 'path';

function readFile(path) {
  return fs.readFileSync(path, { encoding: 'utf-8' });
}

function writeFile(path, data) {
  return fs.writeFileSync(path, data,{ encoding: 'utf-8' });
}

const dirResources = path.resolve(__dirname, '../resources');
const fnTtl = readFile(path.resolve(dirResources, 'sum.ttl'));
const fnTtlComposition = readFile(path.resolve(dirResources, 'sum-composition.ttl'));

describe('FnO 2 CWL tests', () => { // the tests container
  
  it('tests',async () => {
    console.log("Tada!");
    
  })

});

