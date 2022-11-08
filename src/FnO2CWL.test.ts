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

const dirResources = path.resolve(__dirname, '../resources/fno-cwl');
const basenameConcreteWorkflowCWL = 'concrete-wf.cwl'
const basenameConcreteWorkflowTurtle = `${basenameConcreteWorkflowCWL}.ttl`

describe('Tests for example01', () => { // the tests container
  
  const dirContainerResources = path.resolve(dirResources, 'example01');
  const pathConcreteWorkflow = path.resolve(dirContainerResources, basenameConcreteWorkflowCWL);
  
  it('tests',async () => {
    console.log("Tada!");
  });

  it('Contains FnO document of the concrete workflow ',async () => {
    expect(fs.existsSync(pathConcreteWorkflow));
    
  });

  it('Contains FnO document of the abstract workflow ',async () => {
    throw Error('Not Yet Implemented');
    
  });

  it('Correctly loads concrete workflow',async () => {
    throw Error('Not Yet Implemented');
    // TODO: loads without errors
    // TODO: workflow (i.e. the Function Composition) has the expected input parameters
    // TODO: workflow (i.e. the Function Composition) has the expected output parameters
    // TODO: workflow (i.e. the Function Composition) has the expected steps/tasks/functions?
    //  i.e. echo + uppercase
  });

  it('Correctly executes the concrete workflow',async () => {
    throw Error('Not Yet Implemented');
    // TODO: executes without errors?
    // TODO: produces the expected results?
  });


});

