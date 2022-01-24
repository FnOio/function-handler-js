import { Parser } from "acorn";
import N3 from 'n3';
const { namedNode, literal, NamedNode } = require('n3').DataFactory;
import ttlRead from '@graphy/content.ttl.read';
import ttlWrite from '@graphy/content.ttl.write';
import dataset from '@graphy/memory.dataset.fast';
import { Readable } from 'stream';
import prefixes from './src/prefixes';

// const fnString = `
// /**
// * Test function
// */
// function sum(a, b = 0) {
//   return a + b;
// }

// function diff(a, b = 0) {
//   return a - b;
// }
// `;

const fnString = `
function sum(a, b) {
  return a + b;
}
`
// TODO string to implementation
const fn = (a, b) => {
  return a + b;
}

const parsed = Parser.parse(fnString) as any;

const fns = parsed.body.filter(elem => {
  return elem.type === "FunctionDeclaration"
});

const writer = new N3.Writer({ prefixes });

fns.forEach(fn => {
  const myFn = namedNode(`${prefixes.fns}${fn.id.name}`);
  // fno:expects
  const parameters = fn.params;
  const paramNodes: typeof NamedNode[] = [];
  parameters.forEach(param => {
    let name = null;
    let required = true;
    if (param.type === "Identifier") {
      name = param.name;
    } else if (param.type === "AssignmentPattern") {
      name = param.left.name;
      required = false;
    }
    const myParam = namedNode(`${prefixes.fns}${name}Parameter`);
    paramNodes.push(myParam);
    writer.addQuad(myParam, namedNode(`${prefixes.rdf}type`), namedNode(`${prefixes.fno}Parameter`));
    writer.addQuad(myParam, namedNode(`${prefixes.rdfs}label`), literal(name, "en"));
    writer.addQuad(myParam, namedNode(`${prefixes.fno}predicate`), namedNode(`${prefixes.fns}${name}`));
    if (required) {
      writer.addQuad(myParam, namedNode(`${prefixes.fno}required`), literal(true, namedNode(`${prefixes.xsd}boolean`)));
    }
  });
  // fno:returns
  const myOutput = namedNode(`${prefixes.fns}${fn.id.name}Output`);
  writer.addQuad(myOutput, namedNode(`${prefixes.rdf}type`), namedNode(`${prefixes.fno}Output`));
  writer.addQuad(myOutput, namedNode(`${prefixes.rdfs}label`), literal(`${fn.id.name} output`, "en"));
  writer.addQuad(myOutput, namedNode(`${prefixes.fno}predicate`), namedNode(`${prefixes.fno}Result`));

  writer.addQuad(myFn, namedNode(`${prefixes.rdf}type`), namedNode(`${prefixes.fno}Function`));
  writer.addQuad(myFn, namedNode(`${prefixes.dcterms}description`), literal(`Description of the ${fn.id.name} function`, "en"));
  writer.addQuad(myFn, namedNode(`${prefixes.rdfs}label`), literal(fn.id.name, "en"));
  writer.addQuad(myFn, namedNode(`${prefixes.fno}expects`), writer.list(paramNodes));
  writer.addQuad(myFn, namedNode(`${prefixes.fno}returns`), writer.list([myOutput]));

  // fno:implementation
  const myImplementation = namedNode(`${prefixes.fns}${fn.id.name}Implementation`);
  writer.addQuad(myImplementation, namedNode(`${prefixes.rdf}type`), namedNode(`${prefixes.fno}Implementation`));
  writer.addQuad(myImplementation, namedNode(`${prefixes.rdf}type`), namedNode(`${prefixes.fnoi}JavaScriptImplementation`));
  writer.addQuad(myImplementation, namedNode(`${prefixes.rdf}type`), namedNode(`${prefixes.fnoi}JavaScriptFunction`));
  const myRelease = namedNode(`${prefixes.fns}${fn.id.name}ImplementationRelease`);
  writer.addQuad(myImplementation, namedNode(`${prefixes.doap}release`), myRelease);
  const myFile = namedNode(`${prefixes.fns}${fn.id.name}ImplementationReleaseFile`);
  writer.addQuad(myRelease, namedNode(`${prefixes.doap}file-release`), myFile);
  writer.addQuad(myFile, namedNode(`${prefixes.ex}value`), literal(fnString.replace(/[\r\n]+/g, ' '))); // TODO fix no more ex

  // fno:mapping
  const myMapping = namedNode(`${prefixes.fns}${fn.id.name}Mapping`);
  writer.addQuad(myMapping, namedNode(`${prefixes.rdf}type`), namedNode(`${prefixes.fno}Mapping`));
  writer.addQuad(myMapping, namedNode(`${prefixes.fno}function`), myFn);
  writer.addQuad(myMapping, namedNode(`${prefixes.fno}implementation`), myImplementation);
  const paramMappingNodes: typeof NamedNode[] = [];
  paramNodes.forEach((paramNode, index) => {
    const myParameterMapping = namedNode(`${paramNode.value}mapping`);
    paramMappingNodes.push(myParameterMapping);
    writer.addQuad(myParameterMapping, namedNode(`${prefixes.rdf}type`), namedNode(`${prefixes.fno}ParameterMapping`));
    writer.addQuad(myParameterMapping, namedNode(`${prefixes.rdf}type`), namedNode(`${prefixes.fnom}PositionParameterMapping`));
    writer.addQuad(myParameterMapping, namedNode(`${prefixes.fnom}functionParameter`), paramNode);
    writer.addQuad(myParameterMapping, namedNode(`${prefixes.fnom}implementationParameterPosition`), literal(index));
    writer.addQuad(myMapping, namedNode(`${prefixes.fno}parameterMapping`), myParameterMapping);
  })
  const myReturnMapping = namedNode(`${prefixes.fns}${fn.id.name}ReturnMapping`);
  writer.addQuad(myReturnMapping, namedNode(`${prefixes.rdf}type`), namedNode(`${prefixes.fno}ReturnMapping`));
  writer.addQuad(myReturnMapping, namedNode(`${prefixes.rdf}type`), namedNode(`${prefixes.fnom}DefaultReturnMapping`));
  writer.addQuad(myMapping, namedNode(`${prefixes.fno}returnMapping`), myReturnMapping);

  const myMethodMapping = namedNode(`${prefixes.fns}${fn.id.name}MethodMapping`);
  writer.addQuad(myMethodMapping, namedNode(`${prefixes.rdf}type`), namedNode(`${prefixes.fno}MethodMapping`));
  writer.addQuad(myMethodMapping, namedNode(`${prefixes.rdf}type`), namedNode(`${prefixes.fnom}StringMethodMapping`));
  writer.addQuad(myMethodMapping, namedNode(`${prefixes.fnom}method-name`), literal(fn.id.name));
  writer.addQuad(myMapping, namedNode(`${prefixes.fno}methodMapping`), myMethodMapping);
});

writer.end(async (err, result) => {
  // let output = await read(result)
  // // pipe the RDF data thru the DatasetTree package
  //   .pipe(tree())
  //   .pipe(write({prefixes}))
  //   .pipe(process.stdout);
  result = await canonicalize(result)
  console.log(result);
});

/**
 * Create a pretty-printed turtle string from an ugly turtle string
 * @param {*} ttlString 
 * @returns 
 */
async function canonicalize(ttlString) {
  const stream = Readable.from([ttlString]);
  const outStreamPretty = stream
    .pipe(ttlRead())
    .pipe(dataset({
      canonicalize: false,
    }))
    .pipe(ttlWrite());
  return streamToString(outStreamPretty);
}

function streamToString(stream) {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  })
}
