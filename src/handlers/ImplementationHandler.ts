import { ArgumentMap, Handler } from './Handler';
import { CompositionHandler } from './CompositionHandler';

export class ImplementationHandler {
  loadedImplementations: {
    [implementationId: string]: {
      fnId?: string,
      handler: Handler,
      options: any,
    },
  };

  compositionHandler: CompositionHandler;
  constructor() {
    this.loadedImplementations = {};
    this.compositionHandler = new CompositionHandler();
  }

  loadImplementation(implementationId: string, handler: Handler, options: any = null): void {
    this.loadedImplementations[implementationId] = { options, handler };
  }

    // TODO what if same implementation for multiple functions?
  setOptions(implementationId: string, options: any) {
    if (!this.loadedImplementations[implementationId]) {
      return false;
    }
    this.loadedImplementations[implementationId].options = Object.assign(
      this.loadedImplementations[implementationId].options, options);
    return true;
  }

  linkImplementationToFunction(implementationId: string, fnId: string): boolean {
    if (!this.loadedImplementations[implementationId]) {
      return false;
    }
    this.loadedImplementations[implementationId].fnId = fnId;
    return true;
  }

  hasImplementation(implementationId: string): boolean {
    return this.loadedImplementations[implementationId] !== undefined;
  }

  hasImplementationForFunction(fnId: string): boolean {
    return this.getImplementations(fnId).length > 0;
  }

  getImplementations(fnId: string): string[] {
    const out = Object.keys(this.loadedImplementations)
      .filter((implementationId) => {
        return this.loadedImplementations[implementationId].fnId === fnId
          && this.loadedImplementations[implementationId].handler;
      });
    return out;
  }

  async executeImplementation(implementationId: string, args: ArgumentMap) {
    return this.loadedImplementations[implementationId]
      .handler.executeFunction(args, this.loadedImplementations[implementationId].options);
  }
}
