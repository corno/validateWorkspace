import { Async } from "./async"
import { createLeafSyncCaller } from "./sync"

export type Cache<T> = {
    getEntry: (
        key: string,
    ) => Async<T>
}

export function createCache<T>(
    get: (key: string) => Async<T>
): Cache<T> {
    const resolved: { [key: string]: T } = {}
    const resolving: {
        [key: string]: {
            callbacks: ((v: T) => void)[]
        }
    } = {}
    return {
        getEntry: (key) => {
            return {
                execute: (cb) => {

                    if (resolved[key] !== undefined) {
                        //console.log("\tresolved")
                        cb(resolved[key])
                    } else {
                        if (resolving[key] !== undefined) {
                            //console.log("\tresolving")
                            resolving[key].callbacks.push(cb)
                        } else {
                            //console.log("\tto be resolved")

                            const callbacks: ((v: T) => void)[] = []
                            const x = get(key)
                            callbacks.push(cb)
                            resolving[key] = {
                                callbacks
                            }
                            x.execute((v) => {
                                callbacks.forEach(($) => {
                                    $(v)
                                })
                                resolved[key] = v
                                delete resolving[key]
                            })
                        }
                    }
                }
            }
        }
    }
}