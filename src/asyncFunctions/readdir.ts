
import * as fs from "fs"
import { createCounter } from "./createCounter"
import { createDictionary, IDictionary } from "../dictionary"
import * as pth from "path"
import { Async } from "./async"


export type DirNodeData = {
    name: string
    path: string
    type:
    | ["directory", {}]
    | ["file", {}]
    | ["other", {}]
}

export function createDirNodeData(path: string, dirent: fs.Dirent): DirNodeData {
    return {
        name: dirent.name,
        path: `${path}/${dirent.name}`,
        type: dirent.isDirectory()
            ? ["directory", {}]
            : dirent.isFile()
                ? ["file", {}] :
                ["other", {}]
    }
}

export function createLeafFileReader<T>(
    path: string[],
    callback: (
        data: string,
    ) => T,
    error: (
        err: NodeJS.ErrnoException,
    ) => T,
): Async<T> {
    return {
        execute: (cb) => {
            fs.readFile(
                pth.join(... path),
                {
                    encoding: "utf-8",
                },
                (err, data) => {
                    if (err !== null) {
                        cb(error(err))
                    } else {
                        cb(callback(data))
                    }
                }
            )
        },
    }
}

export function createCompositeFileReader<T>(
    path: string[],
    callback: (
        data: string,
    ) => Async<T>,
    error: (
        err: NodeJS.ErrnoException,
    ) => Async<T>,
): Async<T> {
    return {
        execute: (cb) => {
            fs.readFile(
                pth.join(... path),
                {
                    encoding: "utf-8",
                },
                (err, data) => {
                    if (err !== null) {
                        error(err).execute(cb)
                    } else {
                        (callback(data)).execute(cb)
                    }
                }
            )
        },
    }
}

export function createLeafDirReader<T>(
    path: string,
    callback: (
        data: DirNodeData,
    ) => null | T,
): Async<IDictionary<T>> {
    return {
        execute: (cb) => {
            fs.readdir(
                path,
                {
                    withFileTypes: true,
                },
                (err, files) => {
                    if (err !== null) {
                        cb(createDictionary({}))
                    } else {
                        let values: { [key: string]: T } = {}

                        files.forEach(($) => {
                            const res = callback(createDirNodeData(path, $))
                            if (res !== null) {
                                values[$.name] = res
                            }
                        })

                        cb(createDictionary(values))
                    }
                }
            )
        }
    }
}

export function createCompositeDirReader<T>(
    path: string,
    callback: (
        data: DirNodeData,
    ) => null | Async<T>,
): Async<IDictionary<T>> {
    return {
        execute: (cb) => {
            fs.readdir(
                path,
                {
                    withFileTypes: true,
                },
                (err, files) => {
                    if (err !== null) {
                        cb(createDictionary({}))
                    } else {
                        let values: { [key: string]: T } = {}
                        createCounter(
                            (counter) => {
                                files.forEach(($) => {
                                    const subAsync = callback(createDirNodeData(path, $))
                                    if (subAsync !== null) {
                                        counter.increment()
                                        subAsync.execute(
                                            (x) => {
                                                values[$.name] = x
                                                counter.decrement()
                                            }
                                        )
                                    }
                                })
                            },
                            () => {
                                cb(createDictionary(values))
                            }
                        )
                    }
                }
            )
        }
    }
}

export function rewrite<Out, In>(
    source: Async<In>,
    rewrite: (source: In) => Out
): Async<Out> {
    return {
        execute: (cb => {
            source.execute((v) => {
                cb(rewrite(v))
            })
        })
    }
}