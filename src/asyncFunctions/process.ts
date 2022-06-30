import * as cp from "child_process"
import * as asyncAPI from "pareto-async-api"
import * as asyncLib from "pareto-async-lib"

export function createLeafProcessCall<T>(
    command: string,
    onResult: (stdout: string) => T,
    onError: (err: cp.ExecException, stderr: string) => T,
): asyncAPI.IAsync<T> {
    return {
        execute: (cb) => {
            cp.exec(
                command,
                (err, stdout, stderr) => {
                    if (err !== null) {
                        cb(onError(err, stderr))
                    } else {
                        cb(onResult(stdout))
                    }
                }
            )
        }
    }
}

export function createCompositeProcessCall<T>(
    command: string,
    onResult: (stdout: string) => asyncAPI.IAsync<T>,
    onError: (err: cp.ExecException, stderr: string) => asyncAPI.IAsync<T>,
): asyncAPI.IAsync<T> {
    return {
        execute: (cb) => {
            cp.exec(
                command,
                (err, stdout, stderr) => {
                    if (err !== null) {
                        onError(err, stderr).execute(cb)
                    } else {
                        onResult(stdout).execute(cb)
                    }
                }
            )
        }
    }
}