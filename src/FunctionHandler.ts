import { Argument, Function, Implementation, Mapping, Predicate } from './models';
import { GraphHandler, LocalValue } from "./GraphHandler";
import { Handler } from './handlers/Handler';
import * as $rdf from "rdflib";

import prefixes from './prefixes';

export class FunctionHandler {
    private _graphHandler;
    private _handlerIndex = {};

    constructor() {
        this._graphHandler = new GraphHandler();
    }

    async addFunctionResource(iri: string, localValue: LocalValue | null = null) {
        await this._graphHandler.addGraph(iri, localValue)
    };

    async addHandler(handler: Handler) {
        this._handlerIndex[handler.id] = handler;
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

    async executeFunction(fn: Function, args: Argument[], mapping: Mapping | null = null) {
        let mappings: Mapping[] = [];
        if (mapping === null) {
            mappings = this.getMappingsFromFunction(fn);
        } else {
            mappings = [mapping];
        }
        const possibleImplementations: {
            mapping: Mapping,
            implementation: Implementation,
            handler: Handler
        }[] = [];
        if (mappings.length === 0) {
            console.warn(`Could not find any relevant mapping for function ${fn.id}`)
        }
        mappings.forEach(mapping => {
            const implementations = this.getImplementationFromMapping(mapping);
            if (implementations.length === 0) {
                console.warn(`Could not find any relevant implementation for mapping ${mapping.id}`)
                return;
            }
            implementations.forEach(implementation => {
                const handlers = this.getHandlers(implementation);
                if (handlers.length === 0) {
                    console.warn(`Could not find any relevant handlers for implementation ${implementation.id}`)
                    return;
                }
                handlers.forEach(handler => {
                    possibleImplementations.push({
                        mapping,
                        implementation,
                        handler
                    })
                })
            })
        })
        if (possibleImplementations.length === 0) {
            throw new Error(`Could not find any relevant implementation to execute ${fn.id}`)
        }
        const optimalImplementation = possibleImplementations[0];
        return optimalImplementation.handler.executeFunction(optimalImplementation.implementation, this.getArgs(optimalImplementation.mapping, args))
    }

    private getMappingsFromFunction(fn: Function) {
        const mappings = this._graphHandler.match(null, $rdf.sym(`${prefixes.fno}function`), fn.term);
        if (mappings.length === 0) {
            return [];
        }
        return mappings.map(m => new Mapping(m.subject));
    }

    private getImplementationFromMapping(mapping: Mapping) {
        const implementations = this._graphHandler.match(mapping.term, $rdf.sym(`${prefixes.fno}implementation`));
        if (implementations.length === 0) {
            return [];
        }
        return implementations.map(m => new Implementation(m.object));
    }

    private getHandlers(implementation: Implementation) {
        const loadedHandlerClasses = Object.keys(this._handlerIndex);
        const handlers: Handler[] = [];
        loadedHandlerClasses.forEach(c => {
            const match = this._graphHandler.match(implementation.term, $rdf.sym(`${prefixes.rdf}type`), $rdf.sym(c))
            if(match.length > 0) {
                handlers.push(this._handlerIndex[c]);
            }
        })

        return handlers;
    }

    private getArgs(mapping: Mapping, args: Argument[]) {
        const result = {};
        const parameterMappings = this._graphHandler.match(mapping.term, $rdf.sym(`${prefixes.fno}parameterMapping`)).map(p => p.object)
        parameterMappings.forEach(pMapping => {
            let parameter = this._graphHandler.match(pMapping, $rdf.sym(`${prefixes.fnom}functionParameter`)).map(p=>p.object);
            if (parameter.length === 0) {
                console.warn(`Could not find parameter assigned to ${pMapping.value}`)
                return
            }
            if (parameter.length > 1) {
                console.warn(`More parameters for ${pMapping.value} than expected (1). Picking one at random.`)
            }
            parameter = parameter[0];
            const arg = args.filter(a => parameter.value === a.term.value);
            if (!arg) {
                console.warn(`Argument for parameter ${parameter.value} not found`)
                return
            }
            let type = this._graphHandler.match(parameter, $rdf.sym(`${prefixes.fno}type`));
            if (type.length === 0) {
                console.warn(`No type information for parameter ${parameter.value} found`)
            }
            if(type.length > 1) {
                console.warn(`More types for ${parameter.value} than expected (1). Picking one at random.`)
            }
            type = type[0] || null;
            if (this._graphHandler.match(pMapping, $rdf.sym(`${prefixes.rdf}type`), $rdf.sym(`${prefixes.fnom}PositionParameterMapping`)).length > 0) {
                const positions = this._graphHandler.match(pMapping, $rdf.sym(`${prefixes.fnom}implementationParameterPosition`)).map(p => p.object.value);
                positions.forEach(p => {
                    arg.forEach(a => {
                        addToResult(p, a.value, type);
                    })
                })
            } else {
                throw new Error('Unsupported if not positionparametermapping')
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
}
