import { expect } from 'chai';
import { FunctionHandler } from './FunctionHandler';
import { } from 'mocha';
import { JavaScriptHandler } from './handlers/JavaScriptHandler';
import prefixes from './prefixes';
const fs = require('fs');

function readFile(path) {
  return fs.readFileSync(path, { encoding:'utf-8' });
}
const fnTtl = readFile('src/resources/sum.ttl');

const fnTtlComposition = readFile('src/resources/sum-composition.ttl');

describe('FunctionHandler tests', () => { // the tests container

  it.skip('can parse a function file', async () => { // the single test
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
    handler.implementationHandler
      .loadImplementation(`${prefixes.fns}sumImplementation`,
                          jsHandler,
                          { fn: (a, b) => a + b });
    const result = await handler.executeFunction(fn, {
      [`${prefixes.fns}a`]: 1,
      [`${prefixes.fns}b`]: 2,
    });

    expect(result[`${prefixes.fns}out`]).to.equal(3);
    return;
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
    handler.implementationHandler
      .loadImplementation(`${prefixes.fns}sumImplementation`,
                          jsHandler,
                          { fn: (a, b) => a + b });
    const result = await handler.executeFunction(fn, {
      [`${prefixes.fns}a`]: 1,
      [`${prefixes.fns}b`]: 2,
      [`${prefixes.fns}c`]: 3,
    });

    expect(result[`${prefixes.fns}out`]).to.equal(6);
    return;
  });
});

describe('Workflow', () => {
  const handler = new FunctionHandler();
  const ttlParametersAndOutputs = readFile('src/resources/wf/parameters-and-outputs.ttl');
  // Map functionLabel on turtle file
  const labelOnTtlFile = Object
    .fromEntries(['functionA', 'functionB', 'functionC']
                   .map((x) => {
                     return [x, readFile(`src/resources/wf/${x}.ttl`)];
                   }));

  const loadParametersAndOutputsGraph = async () => {
    // Add parameters and outputs graph
    await handler.addFunctionResource(
      `${prefixes.fns}ParamsAndOutputs`,
      {
        type: 'string',
        contents:  ttlParametersAndOutputs,
        contentType: 'text/turtle',
      });
  };
  const loadFunctionResource =  (iri, contents) => {
    return handler.addFunctionResource(iri, // tslint:disable-next-line:align
      {
        contents,
        type:'string',
        contentType:'text/turtle',
      });
  };
  const loadFunctionGraphs = async () => {
    // Add function graphs
    await Promise.all(Object.entries(labelOnTtlFile)
                        .map(([lbl, ttl]) => loadFunctionResource(`${prefixes.fns}${lbl}`, ttl)));
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
    const minimalFunctionTests = (f) => {
      expect(f).not.to.be.null;
      expect(f.id).not.to.be.null;
    };
    functionArray.forEach(minimalFunctionTests);
    // Map function labels to JS implementations
    const functionJavaScriptImplementations = {
      functionA: x => `A(${x})`,
      functionB: x => `B(${x})`,
      functionC: x => `C(${x})`,
    };
    // Load JS implementations
    const jsHandler = new JavaScriptHandler();
    Object.entries(functionJavaScriptImplementations)
      .forEach(([lbl, fn]) => {
        handler.implementationHandler
          .loadImplementation(
            `${prefixes.fns}${lbl}Implementation`,
            jsHandler,
            { fn },
          );
      });

    const resultA = await handler.executeFunction(fnA, { [`${prefixes.fns}str0`]: 1 });
    const resultB = await handler.executeFunction(fnB, { [`${prefixes.fns}str0`]: 2 });
    const resultC = await handler.executeFunction(fnC, { [`${prefixes.fns}str0`]: 3 });

    expect(resultA[`${prefixes.fns}out`]).to.equal('A(1)');
    expect(resultB[`${prefixes.fns}out`]).to.equal('B(2)');
    expect(resultC[`${prefixes.fns}out`]).to.equal('C(3)');

    return;
  });
  //
  it.only('Test composition AB', async () => {
    // load composition resources
    await loadFunctionResource(`${prefixes.fns}compositionAB`,
                               readFile('src/resources/wf/compositionAB.ttl'));
    // function objects
    const fnA = await handler.getFunction(`${prefixes.fns}functionA`);
    const fnB = await handler.getFunction(`${prefixes.fns}functionB`);
    const fnC = await handler.getFunction(`${prefixes.fns}functionC`);
    const fnAB = await handler.getFunction(`${prefixes.fns}functionAB`);
    const functionArray = [fnA, fnB, fnC];
    // Minimal tests that every function must pass
    const minimalFunctionTests = (f) => {
      expect(f).not.to.be.null;
      expect(f.id).not.to.be.null;
    };
    functionArray.forEach(minimalFunctionTests);
    // Map function labels to JS implementations
    const functionJavaScriptImplementations = {
      functionA: x => `A(${x})`,
      functionB: x => `B(${x})`,
      functionC: x => `C(${x})`,
    };
    // Load JS implementations
    const jsHandler = new JavaScriptHandler();
    Object.entries(functionJavaScriptImplementations)
      .forEach(([lbl, fn]) => {
        handler.implementationHandler
          .loadImplementation(
            `${prefixes.fns}${lbl}Implementation`,
            jsHandler,
            { fn },
          );
      });

    const resultA = await handler.executeFunction(fnA, { [`${prefixes.fns}str0`]: 1 });
    const resultB = await handler.executeFunction(fnB, { [`${prefixes.fns}str0`]: 2 });
    const resultC = await handler.executeFunction(fnC, { [`${prefixes.fns}str0`]: 3 });

    expect(resultA[`${prefixes.fns}out`]).to.equal('A(1)');
    expect(resultB[`${prefixes.fns}out`]).to.equal('B(2)');
    expect(resultC[`${prefixes.fns}out`]).to.equal('C(3)');

    console.log(resultA, resultB, resultC);

    const resultAB = await handler.executeFunction(fnAB, { [`${prefixes.fns}str0`]: 1 });
    // TODO: the result is incorrect.
    // expected: 'B(A(1))'
    // actual: 'A(A(1))'
    console.log(resultAB);
    return;
  });
});
