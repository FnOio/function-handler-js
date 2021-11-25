import { ArgumentMap, Handler } from "./Handler";
import { CompositionHandler } from './CompositionHandler';

export class ImplementationHandler {
    private _loadedImplementations: {
        [implementationId: string]: {
            fnId?: string,
            handler: Handler
            options: any
        }
    };
    private _compositionHandler;

    constructor() {
        this._loadedImplementations = {};
        this._compositionHandler = new CompositionHandler();
    }

    get compositionHandler() {
        return this._compositionHandler;
    }

    loadImplementation(implementationId: string, handler: Handler, options: any = null): void {
        this._loadedImplementations[implementationId] = { options, handler };
    }

    // TODO what if same implementation for multiple functions?
    setOptions(implementationId: string, options: any) {
        if (!this._loadedImplementations[implementationId]) {
            return false;
        }
        this._loadedImplementations[implementationId].options = Object.assign(this._loadedImplementations[implementationId].options, options);
        return true;
    }

    linkImplementationToFunction(implementationId: string, fnId: string): boolean {
        if (!this._loadedImplementations[implementationId]) {
            return false;
        }
        this._loadedImplementations[implementationId].fnId = fnId;
        return true;
    }

    hasImplementation(implementationId: string): boolean {
        return this._loadedImplementations[implementationId] !== undefined;
    }

    hasImplementationForFunction(fnId: string): boolean {
        return this.getImplementations(fnId).length > 0;
    }

    getImplementations(fnId: string): string[] {
        return Object.keys(this._loadedImplementations).filter(implementationId => {
            return this._loadedImplementations[implementationId].fnId === fnId && this._loadedImplementations[implementationId].handler
        })
    }

    async executeImplementation(implementationId: string, args: ArgumentMap) {
        return this._loadedImplementations[implementationId].handler.executeFunction(args, this._loadedImplementations[implementationId].options);
    }
}