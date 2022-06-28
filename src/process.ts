import * as cp from "child_process"
import { Async } from "./async"

export function createLeafProcessCall<T>(
    command: string,
    onResult: (stdout: string) => T,
    onError: (err: cp.ExecException, stderr: string) => T,
): Async<T> {
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
    onResult: (stdout: string) => Async<T>,
    onError: (err: cp.ExecException, stderr: string) => Async<T>,
): Async<T> {
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