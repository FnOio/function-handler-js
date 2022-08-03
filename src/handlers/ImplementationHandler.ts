import { ArgumentMap, Handler } from './Handler';
import { CompositionHandler } from './CompositionHandler';

type InternalImplementation = {
  fnId?: string,
  handler: Handler,
  options: any,
}

export class ImplementationHandler {
  private _loadedImplementations: {
    [implementationId: string]: InternalImplementation,
  };
  private _compositionHandler: CompositionHandler;

  constructor() {
    this._loadedImplementations = {};
    this._compositionHandler = new CompositionHandler();
  }

  loadImplementation(implementationId: string, handler: Handler, options: any = null): void {
    this._loadedImplementations[implementationId] = { options, handler };
  }

  loadComposition(implementationId: string, options: any = null): void {
    this._loadedImplementations[implementationId] = { options, handler: this._compositionHandler };
  }

  // TODO what if same implementation for multiple functions?
  setOptions(implementationId: string, options: any) {
    if (!this._loadedImplementations[implementationId]) {
      return false;
    }
    this._loadedImplementations[implementationId].options = Object.assign(
      this._loadedImplementations[implementationId].options, options);
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

  getImplementation(implementationId: string): InternalImplementation {
    return this._loadedImplementations[implementationId];
  }

  hasImplementationForFunction(fnId: string): boolean {
    return this.getImplementations(fnId).length > 0;
  }

  getImplementations(fnId: string): string[] {
    const out = Object.keys(this._loadedImplementations).filter((implementationId) => {
      return this._loadedImplementations[implementationId].fnId === fnId
        && this._loadedImplementations[implementationId].handler;
    });
    return out;
  }

  async executeImplementation(implementationId: string, args: ArgumentMap) {
    return this._loadedImplementations[implementationId].handler.executeFunction(args, this._loadedImplementations[implementationId].options);
  }
}
