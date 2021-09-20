import { Implementation } from "../models";

export abstract class Handler {
    _handlingIri: string

    constructor(handlingIri: string) {
        this._handlingIri = handlingIri;
    }

    get id() {
        return this._handlingIri;
    }

    abstract executeFunction(implementation: Implementation, args: any)
}
