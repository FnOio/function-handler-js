import { namedNode } from "rdflib";

export class Argument {
    private _predicate: string
    private _value: any

    constructor(predicate: string, value: any) {
        this._predicate = predicate;
        this._value = value;
    }

    get term() {
        return namedNode(this._predicate)
    }

    get value() {
        return this._value
    }

}