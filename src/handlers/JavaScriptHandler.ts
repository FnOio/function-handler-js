import { Argument, Implementation, Mapping } from "../models";
import { Handler } from './Handler';
import prefixes from '../prefixes';

export class JavaScriptHandler extends Handler {
    private _loadedFunctions = {};

    constructor() {
        super(`${prefixes.fnoi}JavaScriptFunction`)
    }

    loadFunction(implementation: Implementation, fn: any) {
        this._loadedFunctions[implementation.id] = fn;
    }

    hasImplementation(implementation: Implementation) {
        return this._loadedFunctions[implementation.id] ? true : false;
    }

    async executeFunction(implementation: Implementation, args: {[key: string]: any[]}) {
        if (!this._loadedFunctions[implementation.id]) {
            throw new Error(`Cannot execute ${implementation.id}, as it isn't loaded!`)
        }
        const fnArgs: any[] = [];
        const keys = Object.keys(args).map(k => Number(k)).filter(k => Number.isInteger(k)).sort();
        for (let index = 0; index <= keys[keys.length - 1]; index++) {
            fnArgs[index] = args[index] || null;
        }
        return this._loadedFunctions[implementation.id].apply(null, fnArgs);
    }
}