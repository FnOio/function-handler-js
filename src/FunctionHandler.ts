import { Composition, Function, Implementation, Mapping, Predicate } from './models';
import { GraphHandler, LocalValue } from "./GraphHandler";
import { ArgumentMap, ReturnMap } from './handlers/Handler';
import * as $rdf from "rdflib";
import { resolve, flat as flatten } from 'node-resolve-dependency-graph/lib';


import prefixes from './prefixes';
import { Term } from 'rdf-js';
import { ImplementationHandler } from './handlers/ImplementationHandler';

export class FunctionHandler {
    private _graphHandler: GraphHandler;
    private _implementationHandler: ImplementationHandler;

    constructor() {
        this._graphHandler = new GraphHandler();
        this._implementationHandler = new ImplementationHandler();
    }

    async addFunctionResource(iri: string, localValue: LocalValue | null = null) {
        await this._graphHandler.addGraph(iri, localValue)
    };

    get implementationHandler() {
        return this._implementationHandler;
    }

    async getFunction(iri: string): Promise<Function | null> {
        const term = this._graphHandler.getSubjectOfType(iri, `${prefixes.fno}Function`);
        if (term) {
            return new Function(term);
        }
        return null;
    }

    /**
     * @deprecated
     * @param iri 
     * @returns 
     */
    async getPredicate(iri: string) {
        const term = this._graphHandler.getSubjectOfType(iri);
        if (term) {
            return new Predicate(term);
        }
        return null;
    }

    async executeFunction(fn: Function, args: ArgumentMap) {
        let handler = this.getImplementationViaMappings(fn);
        if (handler) {
            return this._implementationHandler.executeImplementation(handler.id, args)
        } else {
            handler = this.getHandlerViaCompositions(fn);
            if (handler) {
                return this._implementationHandler.executeImplementation(handler.id, args)
            }
        }
        throw new Error(`Could not find any relevant implementation or composition to execute ${fn.id}`)
    }

    private linkMappedImplementations(fn: Function) {
        let mappings: Mapping[] = this.getMappingsFromFunction(fn);
        if (mappings.length === 0) {
            console.warn(`Could not find any relevant mapping for function ${fn.id}`)
        }
        const loaded = {};
        for (const mapping of mappings) {
            const implementations = this.getImplementationsFromMapping(mapping);
            const loadedImplementations = implementations.filter(implementation => {
                return this._implementationHandler.linkImplementationToFunction(implementation.id, fn.id) &&
                    this._implementationHandler.setOptions(implementation.id, {
                        args: this.getArgsFromMapping(mapping),
                        returns: this.getReturnsFromMapping(mapping)
                    });
            })
            if (loadedImplementations.length > 0) {
                loaded[mapping.id] = {
                    mapping,
                    loadedImplementations
                };
            }
        }
        return loaded;
    }

    private getImplementationViaMappings(fn: Function): Implementation | null {
        let mappedImplementations = this.linkMappedImplementations(fn);
        if (Object.keys(mappedImplementations).length === 0) {
            console.warn(`Could not find any relevant mapping for function ${fn.id}`)
        }
        for (const mappingId in mappedImplementations) {
            return mappedImplementations[mappingId].loadedImplementations[0];
        }
        return null;
    }

    private getHandlerViaCompositions(fn: Function): Composition | null {
        let compositions: Composition[] = this.getCompositionsFromFunction(fn);
        if (compositions.length === 0) {
            console.warn(`Could not find any relevant composition for function ${fn.id}`)
        }
        for (const composition of compositions) {
            if (this.tryToLoadComposition(composition)) {
                return composition
            }
        }
        return null;
    }

    private getObjects(subject, predicate) {
        return this._graphHandler.match(subject, predicate, null).map(s => s.object);
    }

    private getSingleObject(subject, predicate) {
        const objects = this.getObjects(subject, predicate);
        if (objects.length === 0) {
            throw Error(`Subject ${subject.value} without ${predicate.value} defined!`)
        }
        if (objects.length > 1) {
            console.warn(`Too many objects for ${predicate.value} found for ${subject.value}, just picking one at random`)
        }
        return objects[0];
    }

    private exists(subject, predicate, object) {
        return this._graphHandler.match(subject, predicate, object).length > 0;
    }

    private getMappingsFromFunction(fn: Function) {
        const mappings = this._graphHandler.match(null, $rdf.sym(`${prefixes.fno}function`), fn.term);
        if (mappings.length === 0) {
            return [];
        }
        return mappings.map(m => new Mapping(m.subject));
    }

    private getImplementationsFromMapping(mapping: Mapping): Implementation[] {
        const implementations = this.getObjects(mapping.term, $rdf.sym(`${prefixes.fno}implementation`));
        if (implementations.length === 0) {
            return [];
        }
        return implementations.map(o => new Implementation(o));
    }

    private getArgsFromMapping(mapping: Mapping): ArgumentMap {
        const parameterMappings = this.getObjects(mapping.term, $rdf.sym(`${prefixes.fno}parameterMapping`));
        const positionArgs = {};
        parameterMappings.forEach(pMapping => {
            let parameter = this.getObjects(pMapping, $rdf.sym(`${prefixes.fnom}functionParameter`));
            if (parameter.length === 0) {
                console.warn(`Could not find parameter assigned to ${pMapping.value}`)
                return
            }
            if (parameter.length > 1) {
                console.warn(`More parameters for ${pMapping.value} than expected (1). Picking one at random.`)
            }
            parameter = parameter[0];
            let type = this.getObjects(parameter, $rdf.sym(`${prefixes.fno}type`));
            let predicate = this.getSingleObject(parameter, $rdf.sym(`${prefixes.fno}predicate`));
            if (type.length === 0) {
                console.warn(`No type information for parameter ${parameter.value} found`)
            }
            if (type.length > 1) {
                console.warn(`More types for ${parameter.value} than expected (1). Picking one at random.`)
            }
            type = type[0] || null;
            if (this._graphHandler.match(pMapping, $rdf.sym(`${prefixes.rdf}type`), $rdf.sym(`${prefixes.fnom}PositionParameterMapping`)).length > 0) {
                const positions = this.getObjects(pMapping, $rdf.sym(`${prefixes.fnom}implementationParameterPosition`)).map(o => o.value);
                positions.forEach(position => {
                        addToResult(positionArgs, position, predicate.value, type);
                })
            } else {
                throw new Error('Unsupported if not positionparametermapping')
            }
        })

        return {
            positionArgs
        }

        function addToResult(result, key, value, type) {
            if (type?.value === `${prefixes.rdf}List`) {
                if (!result[key]) {
                    result[key] = [];
                }
                result[key].push(value);
            } else {
                if (!result[key]) {
                    result[key] = value;
                } else {
                    console.warn(`Multiple values found for argument ${key}. Keeping a random one.`)
                }
            }
        }
    }
    
    private getReturnsFromMapping(mapping: Mapping): ReturnMap {
        const result = {};
        const returnMappings = this.getObjects(mapping.term, $rdf.sym(`${prefixes.fno}returnMapping`));
        returnMappings.forEach(rMapping => {
            let output = this.getObjects(rMapping, $rdf.sym(`${prefixes.fnom}functionOutput`));
            if (output.length === 0) {
                console.warn(`Could not find output assigned to ${rMapping.value}`)
                return
            }
            if (output.length > 1) {
                console.warn(`More outputs for ${rMapping.value} than expected (1). Picking one at random.`)
            }
            output = output[0];
            let predicate = this.getObjects(output, $rdf.sym(`${prefixes.fno}predicate`));
            if (predicate.length === 0) {
                console.warn(`Could not find predicate of ${output.value}`)
                return
            }
            if (output.length > 1) {
                console.warn(`More predicates for ${output.value} than expected (1). Picking one at random.`)
            }
            predicate = predicate[0];

            let type = this.getObjects(output, $rdf.sym(`${prefixes.fno}type`));
            if (type.length === 0) {
                console.warn(`No type information for parameter ${output.value} found`)
            }
            if (type.length > 1) {
                console.warn(`More types for ${output.value} than expected (1). Picking one at random.`)
            }
            type = type[0] || null;
            if (this._graphHandler.match(rMapping, $rdf.sym(`${prefixes.rdf}type`), $rdf.sym(`${prefixes.fnom}DefaultReturnMapping`)).length > 0) {
                addToResult('_default', predicate.value, type);
            } else {
                throw new Error('Unsupported if not defaultReturnMapping')
            }
        })

        return result;

        function addToResult(key, value, type) {
            if (type?.value === `${prefixes.rdf}List`) {
                if (!result[key]) {
                    result[key] = [];
                }
                result[key].push(value);
            } else {
                if (!result[key]) {
                    result[key] = value;
                } else {
                    console.warn(`Multiple values found for argument ${key}. Keeping a random one.`)
                }
            }
        }
    }
    
    private getCompositionsFromFunction(fn: Function): Composition[] {
        const OutputArray = this.getSingleObject(fn.term, $rdf.sym(`${prefixes.fno}returns`)).elements;
        const outHash = OutputArray.map(o => o.value).sort().join('_');
        return this._graphHandler.match(null, $rdf.sym(`${prefixes.rdf}type`), $rdf.sym(`${prefixes.fnoc}Composition`)).map(s => s.subject).filter(composition => {
            const outputs: Term[] = [];
            this.getObjects(composition, $rdf.sym(`${prefixes.fnoc}composedOf`)).forEach(compositionMapping => {
                const mapTos = this.getSingleObject(compositionMapping, $rdf.sym(`${prefixes.fnoc}mapTo`));
                if (this.exists(mapTos, $rdf.sym(`${prefixes.fnoc}constituentFunction`), fn.term)) {
                    const mapOutput = this.getSingleObject(mapTos, $rdf.sym(`${prefixes.fnoc}functionOutput`));
                    outputs.push(mapOutput)
                }
            });
            return outputs.map(o => o.value).sort().join('_') === outHash
        }).map(c => new Composition(c));
    }

    private tryToLoadComposition(composition: Composition) {
        const addFullFunctionToDependency = (compositionMap: Term, composedOfTerm: Term) => {
            const fn = this.getSingleObject(compositionMap, $rdf.sym(`${prefixes.fnoc}constituentFunction`));
            let rootFn = fn;
            try {
                rootFn = this.getSingleObject(fn, $rdf.sym(`${prefixes.fnoc}applies`));
            } catch (e) {
                // no problem
            }
            tryAddFunctionToDependency(fn, rootFn);
            try {
                const param = this.getSingleObject(compositionMap, $rdf.sym(`${prefixes.fnoc}functionParameter`));
                const predicate = this.getSingleObject(param, $rdf.sym(`${prefixes.fno}predicate`));
                addFunctionParameterToDependency(fn, predicate, composedOfTerm);
                return fn.value + '_inputs';
            } catch (e) {
                // no problem
            }
            try {
                const output = this.getSingleObject(compositionMap, $rdf.sym(`${prefixes.fnoc}functionOutput`));
                const predicate = this.getSingleObject(output, $rdf.sym(`${prefixes.fno}predicate`));
                addFunctionOutputToDependency(fn, predicate, composedOfTerm);
                return fn.value + '_outputs';
            } catch (e) {
                // no problem
            }
            return fn.value;
        }
        const composedOfValueMap = {};
        const dependencyMeta = {};
        const dependencyMap = {};
        const composedOfTerms = this.getObjects(composition.term, $rdf.sym(`${prefixes.fnoc}composedOf`));
        composedOfTerms.forEach(composedOfTerm => {
            // - make composedOfMap
            // composedOf1: a
            // composedOf2: b
            // composedOf3: null
            // composedOf4: c
            // composedOf5: null
            composedOfValueMap[composedOfTerm.value] = null;
            // sum31:
            //   inputs: 
            //     a: [composedOf1]
            //     b: [composedOf2]
            //   outputs:
            //     o: [composedOf3]
            // sum32:
            //   inputs:
            //     a: [composedOf3]
            //     b: [composedOf4]
            //   outputs:
            //     o: [composedOf5]
            const mapFrom = this.getSingleObject(composedOfTerm, $rdf.sym(`${prefixes.fnoc}mapFrom`));
            // - make functionMaps for all functions
            const depFrom = addFullFunctionToDependency(mapFrom, composedOfTerm);
            const mapTo = this.getSingleObject(composedOfTerm, $rdf.sym(`${prefixes.fnoc}mapTo`));
            const depTo = addFullFunctionToDependency(mapTo, composedOfTerm);
            // - make full dependency graph
            // let dependencyMap = {
            //     sum3i: [],
            //     sum3: ['sum3i'],
            //     sum3o: ['sum3', 'sum32o'],
            //     sum31i: ['sum3i'],
            //     sum31: ['sum31i'],
            //     sum31o: ['sum31'],
            //     sum32i: ['sum31o', 'sum3i'],
            //     sum32: ['sum32i'],
            //     sum32o: ['sum32'],
            // }
            dependencyMap[depTo].push(depFrom);
        });
        let dependencyList = flatten(resolve(dependencyMap));
        // - first and last must refer to same function === composed function
        let compositionFn = dependencyList[0].slice(0, -7)
        if (dependencyList[0].slice(0, -7) !== dependencyList[dependencyList.length-1].slice(0, -8)) {
            throw new Error(`No unique composed function detected: found ${dependencyList[0]} and ${dependencyList[dependencyList.length-1]}`);
        }
        if (this._implementationHandler.hasImplementation(compositionFn)) {
            return true;
        }

        let otherFn = dependencyList.filter(resolvedId => dependencyMeta[resolvedId].type === 'function' && resolvedId !== compositionFn);
        for (const fnId of otherFn) {
            const mappedImplementations = this.linkMappedImplementations(dependencyMeta[fnId].fn);
            if (Object.keys(mappedImplementations).length === 0) {
                console.warn(`Couldn't link implementation of ${dependencyMeta[fnId].fn.id}`);
                return false;
            }
        }

        this._implementationHandler.loadImplementation(composition.id, this._implementationHandler.compositionHandler, {
            compositionFn,
            composedOfValueMap,
            dependencyMeta,
            dependencyList,
            implementationHandler: this.implementationHandler
        });

        return true;

        function addFunctionParameterToDependency(fn: Term, predicate: Term, composedOf: Term) {
            if (!dependencyMeta[fn.value].inputs[predicate.value]) {
                dependencyMeta[fn.value].inputs[predicate.value] = []
            }
            dependencyMeta[fn.value].inputs[predicate.value].push(composedOf.value);
        }

        function addFunctionOutputToDependency(fn: Term, predicate: Term, composedOf: Term) {
            if (!dependencyMeta[fn.value].outputs[predicate.value]) {
                dependencyMeta[fn.value].outputs[predicate.value] = []
            }
            dependencyMeta[fn.value].outputs[predicate.value].push(composedOf.value);
        }

        function tryAddFunctionToDependency(fn: Term, rootFn: Term) {
            if (!dependencyMap[fn.value]) {
                dependencyMap[fn.value + '_inputs'] = []
                dependencyMeta[fn.value + '_inputs'] = {
                    type: 'inputs'
                }
                dependencyMap[fn.value] = [fn.value + '_inputs']
                dependencyMeta[fn.value] = {
                    type: 'function',
                    fn: rootFn,
                    inputs: {},
                    outputs: {}
                }
                dependencyMap[fn.value + '_outputs'] = [fn.value]
                dependencyMeta[fn.value + '_outputs'] = {
                    type: 'outputs'
                }
            }
        }
    }
}
