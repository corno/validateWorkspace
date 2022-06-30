import { Async } from "./async"


export function createLeafSyncCaller<T>(
    v: T
): Async<T> {
    return {
        execute: (cb) => {
            cb(v)
        }
    }
}