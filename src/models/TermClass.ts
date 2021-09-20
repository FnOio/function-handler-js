import {Term} from 'rdf-js';

export class TermClass {
    _iri: Term

    constructor(iri: Term) {
        this._iri = iri;
    }

    get id() {
        return this._iri.value
    }

    get term() {
        return this._iri
    }
}
