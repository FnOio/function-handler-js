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

function prefix(...args) {
  return args.join('');
}

const dirResources = path.resolve(__dirname, '../resources/fno-cwl');
const basenameConcreteWorkflowCWL = 'cwl2fno-expected-result-concrete-wf'
const basenameConcreteWorkflowTurtle = `${basenameConcreteWorkflowCWL}.ttl`

describe('Tests for example01', () => { // the tests container
  
  const dirContainerResources = path.resolve(dirResources, 'example01');
  const pathConcreteWorkflow = path.resolve(dirContainerResources, basenameConcreteWorkflowTurtle);
  const base = 'file:///Users/gertjandm/Git/KNoWS/projects/WORKFLOWS/fno-cwl/paper/example01/#';
  // Currently storing these specific prefixes/namespaces in a local object

  const ns = {
    gdm: "http://gddmulde.be#",
    wf: "http://gddmulde.be/concrete-wf.cwl#",
    t_echo: "http://gddmulde.be/echo.cwl#",
    t_uc: "http://gddmulde.be/uppercase.cwl#",
  }

  it('tests',async () => {
    console.log("Tada!");
  });

  it('Contains FnO document of the concrete workflow',async () => {
    expect(fs.existsSync(pathConcreteWorkflow));
    
  });

  it('Contains FnO document of the abstract workflow',async () => {
    throw Error('Not Yet Implemented');
    
  });


  it.only('Correctly loads concrete workflow',async () => {
    const handler = new FunctionHandler();
    
    // Load FnO workflow description
    console.log('!!!', ns.gdm)
    
    const iriConcreteWorkflow = prefix(ns.gdm, 'workflowGraph');
    await handler.addFunctionResource(
      iriConcreteWorkflow,
      {
        type: 'string',
        contents: readFile(pathConcreteWorkflow),
        contentType: 'text/turtle'
      }
    );
    
    // IRIs
    const iriWf = prefix(ns.wf, 'Function');
    const iriEcho = prefix(ns.t_echo, 'Function');
    const iriUppercase = prefix(ns.t_uc, 'Function');
    
    // FnO Function objects
    const fWf = await handler.getFunction(iriWf);
    const fEcho = await handler.getFunction(iriEcho);
    const fUppercase = await handler.getFunction(iriUppercase);

    expect(fWf).not.to.be.null;
    expect(fWf.id).not.to.be.null;

    expect(fEcho).not.to.be.null;
    expect(fEcho.id).not.to.be.null;

    expect(fUppercase).not.to.be.null;
    expect(fUppercase.id).not.be.null;
    
    // const fWf = await handler.getFunction(prefix());
    // expect(fWf).not.to.be.null;

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

