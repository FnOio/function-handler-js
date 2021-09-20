import { Function } from "./Function";
import { TermClass } from "./TermClass";
const { blankNode } = require('n3').DataFactory;

export class Execution extends TermClass {
    private _function: Function

    constructor(fn: Function, iri = null) {
        super(iri || blankNode())
        this._function = fn;
    }


}