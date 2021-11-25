import { namedNode } from "rdflib";

export class Return {
    private _predicate: string
    private _value: any

    constructor(predicate: string, value?: any) {
        this._predicate = predicate;
        this._value = value || null;
    }

    get term() {
        return namedNode(this._predicate)
    }

    get value() {
        return this._value
    }

}