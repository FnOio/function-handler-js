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

describe('FunctionHandler tests', () => { // the tests container
  it('can parse a function file', async () => { // the single test
    const handler = new FunctionHandler();
    await handler.addFunctionResource('http://users.ugent.be/~bjdmeest/function/grel.ttl#');

    const fn = await handler.getFunction('http://users.ugent.be/~bjdmeest/function/grel.ttl#array_join');

    expect(fn).to.be.any;
  });

  it('can load a local file, add a handler, and execute a function', async () => {
    const handler = new FunctionHandler();
    await handler.addFunctionResource(`${prefixes.fns}sum`, {
      type: 'string',
      contents: fnTtl,
      contentType: 'text/turtle',
    });
    const fn = await handler.getFunction(`${prefixes.fns}sum`);

    expect(fn).to.be.not.null;

    expect(fn.id).to.equal(`${prefixes.fns}sum`);

    const jsHandler = new JavaScriptHandler();
    handler.implementationHandler.loadImplementation(`${prefixes.fns}sumImplementation`, jsHandler, { fn: (a, b) => a + b });
    const result = await handler.executeFunction(fn, {
      [`${prefixes.fns}a`]: 1,
      [`${prefixes.fns}b`]: 2,
    });

    expect(result[`${prefixes.fns}out`]).to.equal(3);
  });

  it('can load a local file, add a handler, compose, and execute a function', async () => {
    const handler = new FunctionHandler();
    await handler.addFunctionResource(`${prefixes.fns}sum3`, {
      type: 'string',
      contents: fnTtl + fnTtlComposition,
      contentType: 'text/turtle',
    });
    const fn = await handler.getFunction(`${prefixes.fns}sum3`);

    expect(fn).to.be.not.null;

    expect(fn.id).to.equal(`${prefixes.fns}sum3`);

    const jsHandler = new JavaScriptHandler();
    handler.implementationHandler.loadImplementation(`${prefixes.fns}sumImplementation`, jsHandler, { fn: (a, b) => a + b });
    const result = await handler.executeFunction(fn, {
      [`${prefixes.fns}a`]: 1,
      [`${prefixes.fns}b`]: 2,
      [`${prefixes.fns}c`]: 3,
    });

    expect(result[`${prefixes.fns}out`]).to.equal(6);
  });

  it('Function id should not be a function', async () => {
    const handler = new FunctionHandler();
    await handler.addFunctionResource(`${prefixes.fns}sum3`, {
      type: 'string',
      contents: fnTtl + fnTtlComposition,
      contentType: 'text/turtle',
    });
    const fn = await handler.getFunction(`${prefixes.fns}sum3`);
    expect(fn).to.be.not.null;
    expect(fn.id).to.equal(`${prefixes.fns}sum3`);
    const jsHandler = new JavaScriptHandler();
    const iriSumImplementation = `${prefixes.fns}sumImplementation`;
    handler.implementationHandler.loadImplementation(iriSumImplementation, jsHandler, { fn: (a, b) => a + b });

    // This call is needed for the implementationHandler to update its loadedImplementations
    handler.getHandlerViaCompositions(fn);
    const loadedSumImplementation = handler.implementationHandler.getImplementation(iriSumImplementation);
    expect(loadedSumImplementation.fnId).not.to.be.an('function');
    const result = await handler.executeFunction(fn, {
      [`${prefixes.fns}a`]: 1,
      [`${prefixes.fns}b`]: 2,
      [`${prefixes.fns}c`]: 3,
    });
    expect(result[`${prefixes.fns}out`]).to.equal(6);
  });
});

describe('Workflow', () => {
  const handler = new FunctionHandler();
  const dirWorkflowResources = path.join(dirResources, 'workflow');
  const ttlParametersAndOutputs = readFile(path.join(dirWorkflowResources, 'parameters-and-outputs.ttl'));
  // Map functionLabel on turtle file
  const labelOnTtlFile = Object.fromEntries(['functionA', 'functionB', 'functionC'].map((x) => [x, readFile(path.join(dirWorkflowResources, `${x}.ttl`))]));

  const loadParametersAndOutputsGraph = async () => {
    // Add parameters and outputs graph
    await handler.addFunctionResource(
      `${prefixes.fns}ParamsAndOutputs`,
      {
        type: 'string',
        contents: ttlParametersAndOutputs,
        contentType: 'text/turtle',
      },
    );
  };
  const loadFunctionResource = (iri: string, contents: any) => handler.addFunctionResource(
    iri,
    {
      contents,
      type: 'string',
      contentType: 'text/turtle',
    },
  );
  const loadFunctionGraphs = async () => {
    // Add function graphs
    await Promise.all(Object.entries(labelOnTtlFile).map(([lbl, ttl]) => loadFunctionResource(`${prefixes.fns}${lbl}`, ttl)));
  };
  const minimalFunctionTests = (f) => {
    expect(f).not.to.be.null;
    expect(f.id).not.to.be.null;
  };
  // Before the first test
  before(async () => {
    await loadParametersAndOutputsGraph();
    await loadFunctionGraphs();
  });
  //
  it('Test individual functions', async () => {
    // function objects
    const fnA = await handler.getFunction(`${prefixes.fns}functionA`);
    const fnB = await handler.getFunction(`${prefixes.fns}functionB`);
    const fnC = await handler.getFunction(`${prefixes.fns}functionC`);
    const functionArray = [fnA, fnB, fnC];
    // Minimal tests that every function must pass
    functionArray.forEach(minimalFunctionTests);
    // Map function labels to JS implementations
    const functionJavaScriptImplementations = {
      functionA: (x) => `A(${x})`,
      functionB: (x) => `B(${x})`,
      functionC: (x) => `C(${x})`,
    };
    // Load JS implementations
    const jsHandler = new JavaScriptHandler();
    Object.entries(functionJavaScriptImplementations).forEach(([lbl, fn]) => {
      handler.implementationHandler.loadImplementation(`${prefixes.fns}${lbl}Implementation`, jsHandler, { fn });
    });

    const resultA = await handler.executeFunction(fnA, { [`${prefixes.fns}str0`]: 1 });
    const resultB = await handler.executeFunction(fnB, { [`${prefixes.fns}str0`]: 2 });
    const resultC = await handler.executeFunction(fnC, { [`${prefixes.fns}str0`]: 3 });

    expect(resultA[`${prefixes.fns}out`]).to.equal('A(1)');
    expect(resultB[`${prefixes.fns}out`]).to.equal('B(2)');
    expect(resultC[`${prefixes.fns}out`]).to.equal('C(3)');
  });
  //
  it('Test composition AB', async () => {
    // load composition resources
    await loadFunctionResource(`${prefixes.fns}compositionAB`, readFile(path.resolve(dirResources, 'workflow/compositionAB.ttl')));
    // function objects
    const fnA = await handler.getFunction(`${prefixes.fns}functionA`);
    const fnB = await handler.getFunction(`${prefixes.fns}functionB`);
    const fnC = await handler.getFunction(`${prefixes.fns}functionC`);
    const fnAB = await handler.getFunction(`${prefixes.fns}functionAB`);
    const functionArray = [fnA, fnB, fnC];
    // Minimal tests that every function must pass
    functionArray.forEach(minimalFunctionTests);
    // Map function labels to JS implementations
    const functionJavaScriptImplementations = {
      functionA: (x) => `A(${x})`,
      functionB: (x) => `B(${x})`,
      functionC: (x) => `C(${x})`,
    };
    // Load JS implementations
    const jsHandler = new JavaScriptHandler();
    Object.entries(functionJavaScriptImplementations).forEach(([lbl, fn]) => {
      handler.implementationHandler.loadImplementation(`${prefixes.fns}${lbl}Implementation`, jsHandler, { fn });
    });

    const resultAB = await handler.executeFunction(fnAB, { [`${prefixes.fns}str0`]: 1 });
    expect(resultAB[`${prefixes.fns}out`]).to.equal('B(A(1))');
  });
  it('Test composition AB', async () => {
    // load composition resources
    await loadFunctionResource(`${prefixes.fns}compositionAB`, readFile(path.resolve(dirResources, 'workflow/compositionAB.ttl')));
    // function objects

    const fnA = await handler.getFunction(`${prefixes.fns}functionA`);
    const fnB = await handler.getFunction(`${prefixes.fns}functionB`);
    const fnC = await handler.getFunction(`${prefixes.fns}functionC`);
    const fnAB = await handler.getFunction(`${prefixes.fns}functionAB`);
    const functionArray = [fnA, fnB, fnC];
    // Minimal tests that every function must pass
    functionArray.forEach(minimalFunctionTests);
    // Map function labels to JS implementations
    const functionJavaScriptImplementations = {
      functionA: (x) => `A(${x})`,
      functionB: (x) => `B(${x})`,
      functionC: (x) => `C(${x})`,
    };
    // Load JS implementations
    const jsHandler = new JavaScriptHandler();
    Object.entries(functionJavaScriptImplementations).forEach(([lbl, fn]) => {
      handler.implementationHandler.loadImplementation(`${prefixes.fns}${lbl}Implementation`, jsHandler, { fn });
    });

    const resultAB = await handler.executeFunction(fnAB, { [`${prefixes.fns}str0`]: 1 });
    expect(resultAB[`${prefixes.fns}out`]).to.equal('B(A(1))');
  });

  it.only('Test etl-001', async () => {
    // load composition resources
    await loadFunctionResource(`${prefixes.fns}ParamsAndOutputs`, readFile(path.resolve(dirResources, 'workflow/etl-001/parameters-and-outputs.ttl')));
    console.log('loaded parameters and outputs: √');
    // note: tasks in etl-001 use default parameters and outputs graph
    await loadFunctionResource(`${prefixes.fns}tasks`, readFile(path.resolve(dirResources, 'workflow/etl-001/tasks.ttl')));
    console.log('loaded tasks: √');
    await loadFunctionResource(`${prefixes.fns}ETL001`, readFile(path.resolve(dirResources, 'workflow/etl-001/composition.ttl')));
    console.log('loaded composition: √');
    // function objects
    const fnExecuteRMLMapper = await handler.getFunction(`${prefixes.fns}executeRMLMapper`);
    const fnPublish = await handler.getFunction(`${prefixes.fns}publish`);
    const taskFunctions = [fnExecuteRMLMapper, fnPublish];
    taskFunctions.forEach(minimalFunctionTests);
    console.log('taskFunctions passed minimal function tests √');
    // Workflow Composition function
    const fnETL = await handler.getFunction(`${prefixes.fns}ETL`);
    minimalFunctionTests(fnETL);
    // Map function labels to JS implementations
    const functionJavaScriptImplementations = {
      executeRMLMapper: (x) => `executeRMLMapper(${x})`,
      publish: (x) => `publish(${x})`,
    };
    // Load JS implementations
    const jsHandler = new JavaScriptHandler();
    Object.entries(functionJavaScriptImplementations).forEach(([lbl, fn]) => {
      handler.implementationHandler.loadImplementation(`${prefixes.fns}${lbl}Implementation`, jsHandler, { fn });
    });
    const refArg0 = `${prefixes.fns}iri`;
    // Execute composition
    const resultETL = await handler.executeFunction(fnETL, { [refArg0]: 'http://input.be' });
    console.log('result ETL: ', resultETL);
  });

  it.only('Runs posh-001', async () => {
    const dirName = 'posh-001';
    const caseDir = path.resolve(dirResources, 'workflow', dirName);
    const setupCase = async (caseDir) => {
      console.log('setting up case: ' , caseDir)
      // load composition resources
      await loadFunctionResource(`${prefixes.fns}paramsAndOutputs`, readFile(path.resolve(caseDir, 'parameters-and-outputs.ttl')));
      console.log('loaded parameters and outputs: √');
      // note: tasks in etl-001 use default parameters and outputs graph
      await loadFunctionResource(`${prefixes.fns}tasks`, readFile(path.resolve(caseDir, 'tasks.ttl')));
      console.log('loaded tasks: √');
      await loadFunctionResource(`${prefixes.fns}composition`, readFile(path.resolve(caseDir, 'composition.ttl')));
      console.log('loaded composition: √');
    };
    //
    await setupCase(caseDir);
    // function objects
    const fnExecuteRMLMapper = await handler.getFunction(`${prefixes.fns}executeRMLMapper`);
    const fnPublish = await handler.getFunction(`${prefixes.fns}publish`);
    const taskFunctions = [fnExecuteRMLMapper, fnPublish];
    taskFunctions.forEach(minimalFunctionTests);
    console.log('taskFunctions passed minimal function tests √');
    //
    const functionJavaScriptImplementations = {
      executeRMLMapper: async (...args) => {
        console.log(`executeRMLMapper(${args})`);
        let [
          fpathMapping, fpathOutput, fpathRMLMapperJar, fpathRMLMapperTempFolder, sources
        ] = args;
        console.log('❯ args')
        console.log(args)
        // Import RMLMapper wrapper
        const RMLMapperWrapper = require('@rmlio/rmlmapper-java-wrapper');
        // Read mapping
        const mapping = fs.readFileSync(fpathMapping, { encoding: 'utf-8' });
        if (!mapping) throw Error('Mapping is undefined');
        console.log('➜ read rmlmapping')
        // Initialize RMLMapperWrapper
        // TODO: support removeTempFolders & javaVMOptions arguments
        const wrapper = new RMLMapperWrapper(fpathRMLMapperJar, fpathRMLMapperTempFolder, true);
        // Execute RML Mapper
        try {
          console.log('➜ Executing RMLMapper!!! 🧨');
          const result = await wrapper.execute(mapping, {
            sources,
            generateMetadata: false, serialization: 'turtle' });
          const { output } = result;
          console.log('➜ writing output to: ' , fpathOutput);
          writeFile(fpathOutput, output);
        } catch (error) {
          console.log('error while executing rmlmapper 😫');
          console.log(error);
        }

        return fpathOutput;
      },
      publish: (x) => new Error('TODO')
    };
    // Load JS implementations
    const jsHandler = new JavaScriptHandler();
    Object.entries(functionJavaScriptImplementations).forEach(([lbl, fn]) => {
      handler.implementationHandler.loadImplementation(`${prefixes.fns}${lbl}Implementation`, jsHandler, { fn });
    });
    // Helpers
    const _fns = (x) => `${prefixes.fns}${x}`;
    const _resolve = (...parts) => path.resolve(caseDir, ...parts);
    // Arg map
    const fnExecuteRMLMapperArgMap = {
      [_fns('fpathMapping')]: _resolve('mapping.ttl'),
      [_fns('fpathOutput')]: _resolve('out.ttl'),
      [_fns('fpathRMLMapperJar')]: _resolve('..', '..', '..', 'rmlmapper.jar'),
      [_fns('fpathRMLMapperTempFolder')]: _resolve('temp'),
      [_fns('sources')]: {
        'input.csv': readFile(_resolve('input.csv')),
      },
    };
    // Execute
    const fnExecuteRMLMapperResult = await handler.executeFunction(fnExecuteRMLMapper,fnExecuteRMLMapperArgMap);
    console.log('fnExecuteRMLMapperResult result:');
    console.log(fnExecuteRMLMapperResult);
  });
});
