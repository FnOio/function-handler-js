import { Handler } from './Handler';
import prefixes from '../prefixes';
import {exec} from "child_process";
export class RuntimeProcessHandler extends Handler {
    constructor() {
        super(`${prefixes.fnoi}RuntimeProcessHandler`);
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
        
        // Build command to execute
        const cmd = [options.baseCommand, ...fnArgs].join(' ');
        const execPromise = new Promise((resolve,reject)=>{
            exec(cmd, (error,stdout,stderr)=>{
                if (error) {
                    reject(error)
                    return;
                }
                if (stderr) {
                    reject(stderr);
                    return;
                }
                resolve(stdout)
            })
        })
        
        const fnResult = await execPromise;
        const result = {};
        if (options.returns['_default']) {
            result[options.returns['_default']] = fnResult;
        }
        return result;
    }
}