export abstract class Handler {
    _handlingIri: string

    constructor(handlingIri: string) {
        this._handlingIri = handlingIri;
    }

    get id() {
        return this._handlingIri;
    }

    abstract executeFunction(args: ArgumentMap, options: any): Promise<{ [key: string]: any }>
}

/**
 * mapping result for parameters, e.g. position etc
 */
export interface ArgumentMap {
    positionArgs?: {
        [index: string]: string[]
    }
}

/**
 * mapping result for outputs, e.g. default etc
 */
export interface ReturnMap {
    _default?: string
}
