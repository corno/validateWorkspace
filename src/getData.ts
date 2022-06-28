
import { createDictionary, IDictionary } from "./dictionary"
import { createCompositeDirReader, createCompositeFileReader, createLeafFileReader, rewrite } from "./readdir"
import { create2Tuple, create3Tuple, Tuple2 } from "./tuple"
import { createLeafProcessCall } from "./process"
import { createLeafHTTPSCaller } from "./https"
import { createLeafSyncCaller } from "./sync"
import { Async } from "./async"
import { createCache } from "./cache"
import { createDictionaryMapper } from "./createDictionaryMapper"

export type Part = {
    isPublic: boolean
    packageData: PackageData | null
}

export type Project = {
    gitClean: boolean
    parts: IDictionary<Part>
}

export type Overview = {
    projects: IDictionary<Project>
}

export type PackageData = {
    name: string | null,
    version: string | null,
    contentFingerprint: string | null,
    dependencies: IDictionary<Depencency>
    devDependencies: IDictionary<Depencency>
    remote: RemoteData | null
}


export type RemoteData = {
    latestVersion: null | string
    contentFingerprint: null | string
}

export type Depencency = {
    version: string
    remote: RemoteData | null
}

function createRegistryDataGetter(
    name: string
): Async<RemoteData | null> {

    let data = ""
    let hasError = false
    return createLeafHTTPSCaller<RemoteData | null>(
        'registry.npmjs.org',
        `/${name}`,
        (d) => {
            data += d
        },
        (err) => {
            console.error('https', err)
        },
        () => {
            if (hasError) {
                return null
            }
            const json = JSON.parse(data)
            if (json["dist-tags"] === undefined || json["dist-tags"].latest === undefined) {
                return {
                    latestVersion: null,
                    contentFingerprint: null,
                }
            } else {
                const latest = json["dist-tags"].latest
                if (json["versions"][latest] === undefined || json["versions"][latest]["content-fingerprint"] === undefined) {
                    return {
                        latestVersion: latest,
                        contentFingerprint: null,
                    }
                } else {
                    return {
                        latestVersion: latest,
                        contentFingerprint: json["versions"][latest]["content-fingerprint"],

                    }
                }
            }
        }

    )
}

export function getData(
    rootDir: string,
    callback: (o: Overview) => void,
) {

    const registryCache = createCache(
        (key) => {
            return createRegistryDataGetter(key)
        }
    )

    rewrite<Overview, IDictionary<Project>>(
        createCompositeDirReader<Project>(
            rootDir,
            (projectDir) => {
                return rewrite<Project, Tuple2<boolean, IDictionary<Part>>>(
                    create2Tuple<boolean, IDictionary<Part>>(
                        createLeafProcessCall<boolean>(
                            `git -C ${projectDir.path} diff`,
                            (cleanstdout) => {
                                return cleanstdout.trimEnd() === ""
                            },
                            () => {
                                return false
                            },
                        ),
                        createCompositeDirReader<Part>(
                            projectDir.path,
                            (partDir) => {
                                if ([
                                    "pareto",
                                    "dev",
                                    "lib",
                                    "api",
                                    "bin",
                                    "test",
                                ].indexOf(partDir.name) === -1) {
                                    return null
                                } else {
                                    return createCompositeFileReader<Part>(
                                        [partDir.path, `package.json`],
                                        (data) => {
                                            const pkg = JSON.parse(data)

                                            function resolveDependencies(source: any) {
                                                return createDictionaryMapper<string, Depencency>(
                                                    createDictionary<string>(source === undefined ? {} : source),
                                                    (v, k) => {
                                                        return rewrite(
                                                            registryCache.getEntry(k),
                                                            ($) => {
                                                                return {
                                                                    remote: $,
                                                                    version: v,
                                                                }
                                                            }
                                                        )

                                                    }
                                                )
                                            }

                                            return rewrite(
                                                create3Tuple<IDictionary<Depencency>, IDictionary<Depencency>, RemoteData | null>(
                                                    resolveDependencies(pkg.dependencies),
                                                    resolveDependencies(pkg.devDependencies),
                                                    pkg.name === undefined
                                                        ? createLeafSyncCaller(null)
                                                        : registryCache.getEntry(pkg.name)

                                                ),
                                                ($): Part => {
                                                    return {
                                                        isPublic: ["api", "lib", "bin"].indexOf(partDir.name) !== -1,
                                                        packageData: {
                                                            name: pkg.name === undefined ? null : pkg.name,
                                                            version: pkg.version === undefined ? null : pkg.version,
                                                            contentFingerprint: pkg["content-fingerprint"] === undefined ? null : pkg["content-fingerprint"],
                                                            dependencies: $.first,
                                                            devDependencies: $.second,
                                                            remote: $.third,
                                                        }
                                                    }
                                                }
                                            )
                                        },
                                        () => {
                                            return createLeafSyncCaller({
                                                isPublic: ["api", "lib", "bin"].indexOf(partDir.name) !== 1,
                                                packageData: null
                                            })
                                        }
                                    )
                                }
                            },
                        )

                    ),
                    (tuple) => {
                        return {
                            gitClean: tuple.first,
                            parts: tuple.second
                        }
                    },
                )

            }
        ),
        (projects) => {
            return {
                projects: projects
            }
        }
    ).execute(callback)
}