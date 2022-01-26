import { Handler } from './Handler';
import prefixes from '../prefixes';

export class JavaScriptHandler extends Handler {
    constructor() {
        super(`${prefixes.fnoi}JavaScriptFunction`)
    }

    async executeFunction(args: {[predicate: string]: any}, options: any): Promise<{ [key: string]: any }> {
        const fnArgs: any[] = [];
        
        if (Object.keys(options.args.positionArgs).length > 0) {
            const maxArg = Object.keys(options.args.positionArgs).map(k => Number(k)).sort().reverse()[0];
            for (let index = 0; index <= maxArg; index++) {
                if (options.args.positionArgs[index]) {
                    fnArgs.push(args[options.args.positionArgs[index]])
                } else {
                    fnArgs.push(undefined);
                }
            }
        }
        const fnResult = await options.fn.apply(null, fnArgs);
        const result = {};
        if (options.returns['_default']) {
            result[options.returns['_default']] = fnResult;
        }
        return result;
    }
}