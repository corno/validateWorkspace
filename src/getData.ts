
import * as asyncAPI from "pareto-async-api"
import * as asyncLib from "pareto-async-lib"
import * as fsLib from "pareto-filesystem-lib"

import { createLeafProcessCall } from "pareto-process-lib"
import * as https from "pareto-https-lib"

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

export function getData(
    rootDir: string
): asyncAPI.IAsync<Overview> {
    const registryCache = asyncLib.createCache(
        (key) => {
            let data = ""
            let hasError = false
            return https.call<RemoteData | null>(
                'registry.npmjs.org',
                `/${key}`,
                (d) => {
                    data += d
                },
                (err) => {
                    console.error('https', err)
                },
                () => {
                    if (hasError) {
                        return asyncLib.value(null)
                    }
                    const json = JSON.parse(data)
                    if (json["dist-tags"] === undefined || json["dist-tags"].latest === undefined) {
                        return asyncLib.value({
                            latestVersion: null,
                            contentFingerprint: null,
                        })
                    } else {
                        const latest = json["dist-tags"].latest
                        if (json["versions"][latest] === undefined || json["versions"][latest]["content-fingerprint"] === undefined) {
                            return asyncLib.value({
                                latestVersion: latest,
                                contentFingerprint: null,
                            })
                        } else {
                            return asyncLib.value({
                                latestVersion: latest,
                                contentFingerprint: json["versions"][latest]["content-fingerprint"],

                            })
                        }
                    }
                }

            )
        }
    )

    return asyncLib.rewrite<Overview, asyncAPI.IDictionary<Project>>(
        fsLib.directory<Project>(
            rootDir,
            (projectDir) => {
                return asyncLib.rewrite<Project, asyncAPI.Tuple2<boolean, asyncAPI.IDictionary<Part>>>(
                    asyncLib.tuple2<boolean, asyncAPI.IDictionary<Part>>(
                        createLeafProcessCall<boolean>(
                            `git -C ${projectDir.path} diff --exit-code && git -C ${projectDir.path} log origin/master..master --exit-code`,
                            (cleanstdout) => {
                                return cleanstdout.trimEnd() === ""
                            },
                            () => {
                                return false
                            },
                        ),
                        fsLib.directory<Part>(
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
                                    return fsLib.file<Part>(
                                        [partDir.path, `package.json`],
                                        (data) => {
                                            const pkg = JSON.parse(data)

                                            function resolveDependencies(rawJSONDependencies: any) {
                                                return asyncLib.dictionary<Depencency>(
                                                    asyncLib.createDictionary<string>(rawJSONDependencies === undefined ? {} : rawJSONDependencies).map((v, k) => {
                                                        return asyncLib.rewrite(
                                                            registryCache.getEntry(k),
                                                            ($) => {
                                                                return {
                                                                    remote: $,
                                                                    version: v,
                                                                }
                                                            }
                                                        )

                                                    })
                                                )
                                            }

                                            return asyncLib.rewrite(
                                                asyncLib.tuple3<asyncAPI.IDictionary<Depencency>, asyncAPI.IDictionary<Depencency>, RemoteData | null>(
                                                    resolveDependencies(pkg.dependencies),
                                                    resolveDependencies(pkg.devDependencies),
                                                    pkg.name === undefined
                                                        ? asyncLib.value(null)
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
                                            return asyncLib.value({
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
    )
}