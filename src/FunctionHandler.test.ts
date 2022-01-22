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

  it.only('wf01', async () => {
    const handler = new FunctionHandler();
    const ttlParametersAndOutputs = readFile('src/resources/wf/parameters-and-outputs.ttl');
    const ttlWf01 = readFile('src/resources/wf/wf01.ttl');
    const ttlWfFunctionA = readFile('src/resources/wf/functionA.ttl');
    const ttlWfFunctionB = readFile('src/resources/wf/functionB.ttl');
    const ttlWfFunctionC = readFile('src/resources/wf/functionC.ttl');

    const labelOnTtlFile = Object
      .fromEntries(['functionA', 'functionB', 'functionC']
                     .map((x) => {
                       return [x, readFile(`src/resources/wf/${x}.ttl`)];
                     }));
    await Promise.all(Object.entries(labelOnTtlFile)
      .map(([lbl, ttl]) => handler.addFunctionResource(
        `${prefixes.fns}${lbl}`,
        {
          type: 'string',
          contents: ttlParametersAndOutputs + ttl,
          contentType: 'text/turtle',
        })));

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
    const functionJavaScriptImplementations = {
      functionA: x => {
        const stophere=0;
        return `A(${x})`;
      },
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
            { fn: fn },
          );
      });

    const resultA = await handler.executeFunction(fnA, { [`${prefixes.fns}str0`]: 1 });
    const resultB = await handler.executeFunction(fnB, { [`${prefixes.fns}str0`]: 2 });
    const resultC = await handler.executeFunction(fnC, { [`${prefixes.fns}str0`]: 3 });

    console.log(`
    resultA: ${JSON.stringify(resultA)}
    resultB: ${JSON.stringify(resultB)}
    resultC: ${JSON.stringify(resultC)}
    `);
    // expect(fn.id).to.equal(`${prefixes.fns}functionA`);
    //
    // const jsHandler = new JavaScriptHandler();
    // handler.implementationHandler
    //   .loadImplementation(`${prefixes.fns}functionAImplementation`,
    //                       jsHandler,
    //                       { fn: x => `A(${x})` });
    // const result = await handler.executeFunction(fn, {
    //   [`${prefixes.fns}str0`]: 1,
    //   [`${prefixes.fns}b`]: 2,
    //   [`${prefixes.fns}c`]: 3,
    // });

    // expect(result[`${prefixes.fns}out`]).to.equal(6);
    return;
  });
});
