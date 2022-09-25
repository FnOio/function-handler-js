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
  const dirWorkflowResources = path.join(dirResources, 'workflow');

  const loadFunctionResource = (handler, iri: string, contents: any) => handler.addFunctionResource(
    iri,
    {
      contents,
      type: 'string',
      contentType: 'text/turtle',
    },
  );

  const minimalFunctionTests = (f) => {
    expect(f).not.to.be.null;
    expect(f.id).not.to.be.null;
  };

  /**
   * Creates a function handler for the given testcase.
   * @param caseDir
   */
  const setupCase = async (caseDir) => {
    const handler = new FunctionHandler();
    console.log('setting up case: ' , caseDir)
    // load composition resources
    await loadFunctionResource(handler, `${prefixes.fns}paramsAndOutputs`, readFile(path.resolve(caseDir, 'parameters-and-outputs.ttl')));
    console.log('loaded parameters and outputs: √');
    await loadFunctionResource(handler,`${prefixes.fns}tasks`, readFile(path.resolve(caseDir, 'tasks.ttl')));
    console.log('loaded tasks: √');
    await loadFunctionResource(handler,`${prefixes.fns}composition`, readFile(path.resolve(caseDir, 'composition.ttl')));
    console.log('loaded composition: √');
    return handler;
  };

  /**
   *
   */
  it('Verify ETL execution sequence', async () => {
    // load composition resources
    const dirName = 'etl-001';
    const caseDir = path.resolve(dirWorkflowResources, dirName);
    // Setup handler for current testcase
    const handler = await setupCase(caseDir);
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
    const result = await handler.executeFunction(fnETL, { [refArg0]: 'http://input.be' });
    expect(result[`${prefixes.fns}out`]).to.equal('publish(executeRMLMapper(http://input.be))');
  });

  /**
   * This testcase executes an ETL workflow configured to execute the first task (generateRDF)
   * using Tool A.
   */
  it('Runs ETL using Tool A', async () => {
    const dirName = 'etl-toolA';
    const caseDir = path.resolve(dirWorkflowResources, dirName);
    // Setup handler for current testcase
    const handler = await setupCase(caseDir);
    // function objects
    const fnGenerateRDF = await handler.getFunction(`${prefixes.fns}generateRDF`);
    const fnPublish = await handler.getFunction(`${prefixes.fns}publish`);
    const taskFunctions = [fnGenerateRDF, fnPublish];
    taskFunctions.forEach(minimalFunctionTests);
    console.log('taskFunctions passed minimal function tests √');
    // JS task implementations
    const functionJavaScriptImplementations = {
      generateRDFUsingToolA: (...args) => {
        console.log('⚠️ generateRDF using Tool A');
        const [fpathMapping,] = args;
        console.log(fpathMapping);
        return 'file://path/to/rdf_output.ttl';
      },
      generateRDFUsingToolB: (...args) => {
        console.log('⚠️ generateRDF using Tool B');
        throw Error('generateRDFUsingToolB should not be executed for the current testcase!');
      },
      publish: (...args) => {
        console.log('⚠️ publish');
        const [fpathRDFData,] = args;
        console.log(fpathRDFData);
        return 'http://localhost/sparql';
      },
    };
    // Load JS implementations
    console.log('Loading JS implementations into FnO Implementation Handler');
    const jsHandler = new JavaScriptHandler();
    Object.entries(functionJavaScriptImplementations).forEach(([lbl, fn]) => {
      const implementationId = `${prefixes.fns}${lbl}Implementation`;
      console.log('Loading implementation: ', implementationId);
      handler.implementationHandler.loadImplementation(implementationId, jsHandler, { fn });
    });
    // Helpers
    const _fns = (x) => `${prefixes.fns}${x}`;
    const _resolve = (...parts) => path.resolve(caseDir, ...parts);

    // Load composition
    const fnETL = await handler.getFunction(`${prefixes.fns}ETL`);
    // Test whether the composition is loaded
    minimalFunctionTests(fnETL);
    console.log('fnETL passed minimal function tests √');
    // Create argmap from its constituting function argmaps
    const fnETLArgMap = {
      [_fns('fpathMapping')]: _resolve('mapping.ttl')
    };
    console.log('Fasten your seatbelts. We are ready for take off!');
    // Execute
    const fnETLResult = await handler.executeFunction(fnETL, fnETLArgMap);
    console.log('fnETLResult');
    console.log(fnETLResult);
  });

  /**
   * This testcase executes an ETL workflow configured to execute the first task (generateRDF)
   * using Tool B.
   */
  it('Runs ETL using Tool B', async () => {
    const dirName = 'etl-toolB';
    const caseDir = path.resolve(dirWorkflowResources, dirName);
    // Setup handler for current testcase
    const handler = await setupCase(caseDir);
    // function objects
    const fnGenerateRDF = await handler.getFunction(`${prefixes.fns}generateRDF`);
    const fnPublish = await handler.getFunction(`${prefixes.fns}publish`);
    const taskFunctions = [fnGenerateRDF, fnPublish];
    taskFunctions.forEach(minimalFunctionTests);
    console.log('taskFunctions passed minimal function tests √');
    // JS task implementations
    const functionJavaScriptImplementations = {
      generateRDFUsingToolA: (...args) => {
        console.log('⚠️ generateRDF using Tool A');
        throw Error('generateRDFUsingToolA should not be executed for the current testcase!');
      },
      generateRDFUsingToolB: (...args) => {
        console.log('⚠️ generateRDF using Tool B');
        const [fpathMapping,] = args;
        console.log(fpathMapping);
        return 'file://path/to/rdf_output.ttl';
      },
      publish: (...args) => {
        console.log('⚠️ publish');
        const [fpathRDFData,] = args;
        console.log(fpathRDFData);
        return 'http://localhost/sparql';
      },
    };
    // Load JS implementations
    console.log('Loading JS implementations into FnO Implementation Handler');
    const jsHandler = new JavaScriptHandler();
    Object.entries(functionJavaScriptImplementations).forEach(([lbl, fn]) => {
      const implementationId = `${prefixes.fns}${lbl}Implementation`;
      console.log('Loading implementation: ', implementationId);
      handler.implementationHandler.loadImplementation(implementationId, jsHandler, { fn });
    });
    // Helpers
    const _fns = (x) => `${prefixes.fns}${x}`;
    const _resolve = (...parts) => path.resolve(caseDir, ...parts);

    // Load composition
    const fnETL = await handler.getFunction(`${prefixes.fns}ETL`);
    // Test whether the composition is loaded
    minimalFunctionTests(fnETL);
    console.log('fnETL passed minimal function tests √');
    // Create argmap from its constituting function argmaps
    const fnETLArgMap = {
      [_fns('fpathMapping')]: _resolve('mapping.ttl')
    };
    console.log('Fasten your seatbelts. We are ready for take off!');
    // Execute
    const fnETLResult = await handler.executeFunction(fnETL, fnETLArgMap);
    console.log('fnETLResult');
    console.log(fnETLResult);
  });


  /**
   * This testcase executes an ETL workflow configured to execute the first task (generateRDF)
   * using the RMLMapper.
   */
  it('Runs ETL', async () => {
    const dirName = 'etl';
    const caseDir = path.resolve(dirWorkflowResources, dirName);
    // Setup handler for current testcase
    const handler = await setupCase(caseDir);
    // function objects
    const fnGenerateRDF = await handler.getFunction(`${prefixes.fns}generateRDF`);
    const fnPublish = await handler.getFunction(`${prefixes.fns}publish`);
    const taskFunctions = [fnGenerateRDF, fnPublish];
    taskFunctions.forEach(minimalFunctionTests);
    console.log('taskFunctions passed minimal function tests √');
    // JS task implementations
    const functionJavaScriptImplementations = {
      generateRDFUsingToolA: (...args) => {
        console.log('⚠️ generateRDF using Tool A');
        throw Error('generateRDFUsingToolA should not be executed for the current testcase!');
      },
      generateRDFUsingToolB: (...args) => {
        console.log('⚠️ generateRDF using Tool B');
        throw Error('generateRDFUsingToolB should not be executed for the current testcase!');
      },
      executeRMLMapper: async (...args) => {
        console.log('⚠️ executeRMLMapper');
        let [
          fpathMapping
        ] = args;
        console.log('❯ args')
        console.log(args)
        // Import RMLMapper wrapper
        const RMLMapperWrapper = require('@rmlio/rmlmapper-java-wrapper');
        // Configuration
        const fpathRMLMapperJar = path.resolve(caseDir, '../../../rmlmapper.jar');
        const fpathRMLMapperTempFolder = path.resolve(caseDir, 'temp');
        const fpathOutput = path.resolve(caseDir, 'out.ttl');
        const sources = {
            'input.csv': readFile(_resolve('input.csv')),
          };
        // Read mapping
        const mapping = fs.readFileSync(fpathMapping, { encoding: 'utf-8' });
        if (!mapping) throw Error('Mapping is undefined');
        console.log('➜ read rmlmapping')
        // Initialize RMLMapperWrapper
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
      publish: (...args) => {
        console.log('⚠️ publish');
        const [fpathRDFData,] = args;
        console.log(fpathRDFData);
        return 'http://localhost/sparql';
      },
    };

    // Load JS implementations
    console.log('Loading JS implementations into FnO Implementation Handler');
    const jsHandler = new JavaScriptHandler();
    Object.entries(functionJavaScriptImplementations).forEach(([lbl, fn]) => {
      const implementationId = `${prefixes.fns}${lbl}Implementation`;
      console.log('Loading implementation: ', implementationId);
      handler.implementationHandler.loadImplementation(implementationId, jsHandler, { fn });
    });
    // Helpers
    const _fns = (x) => `${prefixes.fns}${x}`;
    const _resolve = (...parts) => path.resolve(caseDir, ...parts);

    // Load composition
    const fnETL = await handler.getFunction(`${prefixes.fns}ETL`);
    // Test whether the composition is loaded
    minimalFunctionTests(fnETL);
    console.log('fnETL passed minimal function tests √');
    // Create argmap from its constituting function argmaps
    const fnETLArgMap = {
      [_fns('fpathMapping')]: _resolve('mapping.ttl')
    };
    console.log('Fasten your seatbelts. We are ready for take off!');
    // Execute
    const fnETLResult = await handler.executeFunction(fnETL, fnETLArgMap);
    console.log('fnETLResult');
    console.log(fnETLResult);
  });

  /**
   * This testcase executes an ETL workflow of which the executeRMLMapper parameters are configurable.
   */
  it('Runs posh-001', async () => {
    const dirName = 'posh-001';
    const caseDir = path.resolve(dirWorkflowResources, dirName);
    // Setup handler for current testcase
    const handler = await setupCase(caseDir);
    // function objects
    const fnExecuteRMLMapper = await handler.getFunction(`${prefixes.fns}executeRMLMapper`);
    const fnPublish = await handler.getFunction(`${prefixes.fns}publish`);
    const taskFunctions = [fnExecuteRMLMapper, fnPublish];
    taskFunctions.forEach(minimalFunctionTests);
    console.log('taskFunctions passed minimal function tests √');
    //
    const functionJavaScriptImplementations = {
      executeRMLMapper: async (...args) => {
        console.log('⚠️ executeRMLMapper');
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
      publish: (...args) => {
        console.log('⚠️ publish');
        const [fpathRDFData,] = args;
        console.log(fpathRDFData);
        return 'http://localhost/sparql';
      },
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

    // Load composition
    // Create argmap from its constituting function argmaps
    const fnETLArgMap = { ...fnExecuteRMLMapperArgMap };
    const fnETL = await handler.getFunction(`${prefixes.fns}ETL`);
    minimalFunctionTests(fnETL);
    console.log('fnETL passed minimal function tests √');
    // Execute
    const fnETLResult = await handler.executeFunction(fnETL, fnETLArgMap);
    console.log('fnETLResult');
    console.log(fnETLResult);
  });


});

describe('FnO-CWL', () => {
  const dirWorkflowResources = path.join(dirResources, 'fno-cwl');

  const loadFunctionResource = (handler, iri: string, contents: any) => handler.addFunctionResource(
    iri,
    {
      contents,
      type: 'string',
      contentType: 'text/turtle',
    },
  );

  const minimalFunctionTests = (f) => {
    expect(f).not.to.be.null;
    expect(f.id).not.to.be.null;
  };

  /**
   * Creates a function handler for the given testcase.
   * @param caseDir
   */
  const setupCase = async (caseDir) => {
    const handler = new FunctionHandler();
    console.log('setting up case: ' , caseDir)
    // load abstract function description
    await loadFunctionResource(handler, `${prefixes.fns}abstract`, readFile(path.resolve(caseDir, 'abstract.fno.ttl')));
    console.log('loaded abstract function description √');
    await loadFunctionResource(handler, `${prefixes.fns}concrete`, readFile(path.resolve(caseDir, 'concrete.fno.ttl')));
    console.log('loaded concrete function description √');
    
    return handler;
  };

  /**
   *
   */
  it('toUpperCase', async () => {
    // load composition resources
    const dirName = 'toUpperCase';
    const caseDir = path.resolve(dirWorkflowResources, dirName);
    // Setup handler for current testcase
    const handler = await setupCase(caseDir);
    // function objects
    const fnToUpperCase = await handler.getFunction(`${prefixes.fns}upperCaseFunction`);
    minimalFunctionTests(fnToUpperCase)
    // Map function labels to JS implementations
    const functionJavaScriptImplementations = {
      upperCaseFunction: (x) => x.toUpperCase()
    };
    // Load JS implementations
    const jsHandler = new JavaScriptHandler();
    Object.entries(functionJavaScriptImplementations).forEach(([lbl, fn]) => {
      console.log(`${prefixes.fns}${lbl}Implementation`);
      
      handler.implementationHandler.loadImplementation(`${prefixes.fns}${lbl}Implementation`, jsHandler, { fn });
    });
    const refArg0 = `${prefixes.fns}x`;
    // Execute composition
    const result = await handler.executeFunction(fnToUpperCase, { [refArg0]: 'abc' });
    expect(result[`${prefixes.fns}out`]).to.equal('ABC');
  });

  

});

