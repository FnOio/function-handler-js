import { Handler } from './Handler';
import prefixes from '../prefixes';
import { ImplementationHandler } from './ImplementationHandler';
import { Function } from '../models';

type CompositionHandlerOptions = {
    compositionFn: string,
    composedOfValueMap: any,
    dependencyMeta: {
        [compositionFn: string]: {
            type: string
            fn: Function,
            inputs: {
                [predicate: string]: string[],
            },
            outputs: {
                [predicate: string]: string[],
            },
        },
    },
    dependencyList: any,
    implementationHandler: ImplementationHandler,
};

export class CompositionHandler extends Handler {
    constructor() {
        super(`${prefixes.fnoi}CompositionFunction`);
    }

    async executeFunction(args: { [key: string]: any[] }, options: CompositionHandlerOptions):
        Promise<{ [key: string]: any }> {
        // - composedOfMap
        // composedOf1: aValue
        // composedOf2: bValue
        // composedOf3: null
        // composedOf4: cValue
        // composedOf5: null
        // - functionMaps
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
        // - full dependency graph
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
        // - fill in inputs in composedOfMap
        const compositionFn = options.compositionFn;
        Object.keys(options.dependencyMeta[compositionFn].inputs).forEach((predicate) => {
            options.dependencyMeta[compositionFn].inputs[predicate].forEach((compositionId) => {
                options.composedOfValueMap[compositionId] = args[predicate];
            });
        });
        // - for function of dependencygraph of non-composed functions
        //   execute functionMap and fill in composedOfMap
        for (const id of options.dependencyList) {
            if (options.dependencyMeta[id].type !== 'function' || id === compositionFn) {
                continue;
            }
            const implementationId = options.implementationHandler.getImplementations(options.dependencyMeta[id].fn.id)[0];
            const thisArgs = {};
            for (const predicate in options.dependencyMeta[id].inputs) {
                thisArgs[predicate] = options.composedOfValueMap[options.dependencyMeta[id].inputs[predicate][0]];
            }
            const results = await options.implementationHandler.executeImplementation(implementationId, thisArgs);
            Object.keys(results).forEach(predicate => {
                options.dependencyMeta[id].outputs[predicate].forEach(compositionId => {
                    options.composedOfValueMap[compositionId] = results[predicate];
                });
            });
        }
        // - return outputs of composedOfMap
        const results = {};
        Object.keys(options.dependencyMeta[compositionFn].outputs).forEach((predicate) => {
            options.dependencyMeta[compositionFn].outputs[predicate].forEach((compositionId) => {
                results[predicate] = options.composedOfValueMap[compositionId];
            });
        });
        return results;
    }
}
