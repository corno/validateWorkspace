
import * as asyncAPI from "pareto-async-api"
import * as asyncLib from "pareto-async-lib"
import * as fsLib from "pareto-filesystem-lib"

import { createLeafProcessCall } from "./asyncFunctions/process"
import { createLeafHTTPSCaller } from "./asyncFunctions/https"

export type Part = {
    isPublic: boolean
    packageData: PackageData | null
}

export type Project = {
    gitClean: boolean
    parts: asyncAPI.IDictionary<Part>
}

export type Overview = {
    projects: asyncAPI.IDictionary<Project>
}

export type PackageData = {
    name: string | null,
    version: string | null,
    contentFingerprint: string | null,
    dependencies: asyncAPI.IDictionary<Depencency>
    devDependencies: asyncAPI.IDictionary<Depencency>
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
): asyncAPI.IAsync<RemoteData | null> {

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

    const registryCache = asyncLib.createCache(
        (key) => {
            return createRegistryDataGetter(key)
        }
    )

    asyncLib.rewrite<Overview, asyncAPI.IDictionary<Project>>(
        fsLib.createCompositeDirReader<Project>(
            rootDir,
            (projectDir) => {
                return asyncLib.rewrite<Project, asyncAPI.Tuple2<boolean, asyncAPI.IDictionary<Part>>>(
                    asyncLib.create2Tuple<boolean, asyncAPI.IDictionary<Part>>(
                        createLeafProcessCall<boolean>(
                            `git -C ${projectDir.path} diff --exit-code && git -C ${projectDir.path} log origin/master..master --exit-code`,
                            (cleanstdout) => {
                                return cleanstdout.trimEnd() === ""
                            },
                            () => {
                                return false
                            },
                        ),
                        fsLib.createCompositeDirReader<Part>(
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
                                    return fsLib.createCompositeFileReader<Part>(
                                        [partDir.path, `package.json`],
                                        (data) => {
                                            const pkg = JSON.parse(data)

                                            function resolveDependencies(source: any) {
                                                return asyncLib.createDictionaryMapper<string, Depencency>(
                                                    asyncLib.createDictionary<string>(source === undefined ? {} : source),
                                                    (v, k) => {
                                                        return asyncLib.rewrite(
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

                                            return asyncLib.rewrite(
                                                asyncLib.create3Tuple<asyncAPI.IDictionary<Depencency>, asyncAPI.IDictionary<Depencency>, RemoteData | null>(
                                                    resolveDependencies(pkg.dependencies),
                                                    resolveDependencies(pkg.devDependencies),
                                                    pkg.name === undefined
                                                        ? asyncLib.createLeafSyncCaller(null)
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
                                            return asyncLib.createLeafSyncCaller({
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