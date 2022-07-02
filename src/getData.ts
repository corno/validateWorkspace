
import * as asyncAPI from "pareto-async-api"
import * as asyncLib from "pareto-async-lib"
import * as fsLib from "pareto-filesystem-lib"
import * as api from "./types"

import { createLeafProcessCall } from "pareto-process-lib"
import * as https from "pareto-https-lib"

export function getData(
    rootDir: string
): asyncAPI.IAsync<api.Overview> {
    const registryCache = asyncLib.createCache(
        (key) => {
            let data = ""
            let hasError = false
            return https.call<api.RemoteData | null>(
                'registry.npmjs.org',
                `/${key}`,
                (d) => {
                    data += d
                },
                (err) => {
                    console.error('https', err)
                },
                () => {
                    return asyncLib.value(
                        (() => {
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
                        })()
                    )

                }

            )
        }
    )

    return asyncLib.rewrite<api.Overview, asyncAPI.IDictionary<api.Project>>(
        fsLib.directory<api.Project>(
            rootDir,
            (projectDir) => {
                return asyncLib.rewrite<api.Project, asyncAPI.Tuple2<boolean, asyncAPI.IDictionary<api.Part>>>(
                    asyncLib.tuple2<boolean, asyncAPI.IDictionary<api.Part>>(
                        createLeafProcessCall<boolean>(
                            `git -C ${projectDir.path} diff --exit-code && git -C ${projectDir.path} log origin/master..master --exit-code`,
                            (cleanstdout) => {
                                return cleanstdout.trimEnd() === ""
                            },
                            () => {
                                return false
                            },
                        ),
                        fsLib.directory<api.Part>(
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
                                    return fsLib.file<api.Part>(
                                        [partDir.path, `package.json`],
                                        (data) => {
                                            const pkg = JSON.parse(data)

                                            function resolveDependencies(rawJSONDependencies: any) {
                                                return asyncLib.dictionary<api.Depencency>(
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
                                                asyncLib.tuple3<asyncAPI.IDictionary<api.Depencency>, asyncAPI.IDictionary<api.Depencency>, api.RemoteData | null>(
                                                    resolveDependencies(pkg.dependencies),
                                                    resolveDependencies(pkg.devDependencies),
                                                    pkg.name === undefined
                                                        ? asyncLib.value(null)
                                                        : registryCache.getEntry(pkg.name)

                                                ),
                                                ($): api.Part => {
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