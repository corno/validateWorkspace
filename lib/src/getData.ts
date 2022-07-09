
import * as api from "pareto-validate-workspace-api"

import * as pa from "pareto-api-core"
import * as pl from "pareto-lib-core"
import * as asyncFunctionsAPI from "pareto-async-functions-api"
import * as httpsAPI from "pareto-https-api"
import * as fsAPI from "pareto-filesystem-api"
import * as processAPI from "pareto-process-api"

import * as pr from "pareto-runtime"


export function getData(
    libs: {
        fs: fsAPI.API
        async: asyncFunctionsAPI.API,
        https: httpsAPI.API,
        process: processAPI.API,
    },
) {
    function getDataImp(
        rootDir: string,
        error: (message: string) => void,
    ): pa.IAsync<api.Overview> {
        const registryCache = libs.async.createCache(
            (key) => {
                let data = ""
                let hasError = false
                return libs.https.call<api.RemoteData | null>(
                    'registry.npmjs.org',
                    `/${key}`,
                    (d) => {
                        data += d
                    },
                    (err) => {
                        error(`https error, NO ADDITIONAL DATA`)
                    },
                    () => {
                        return libs.async.value(
                            (() => {
                                if (hasError) {
                                    return null
                                }
                                const json = pr.JSONparse(data)
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

        return libs.async.rewrite<api.Overview, pa.IReadonlyDictionary<api.Project>>(
            libs.fs.directory<api.Project>(
                [rootDir],
                (projectDir) => {
                    return libs.async.tuple2(
                            libs.process.call<boolean>(
                                `git -C ${projectDir.path} diff --exit-code && git -C ${projectDir.path} log origin/master..master --exit-code`,
                                {
                                    onResult: (cleanstdout) => {
                                        return libs.async.value(cleanstdout.trimEnd() === "")
                                    },
                                    onError: () => {
                                        return libs.async.value(false)
                                    }
                                },
                            ),
                            libs.fs.directory<api.Part>(
                                [projectDir.path],
                                (partDir) => {
                                    if ([
                                        "pareto",
                                        "dev",
                                        "res",
                                        "lib",
                                        "api",
                                        "bin",
                                        "test",
                                    ].indexOf(partDir.name) === -1) {
                                        return null
                                    } else {
                                        return libs.fs.file<api.Part>(
                                            [partDir.path, `package.json`],
                                            (data) => {
                                                const pkg = pr.JSONparse(data)

                                                function resolveDependencies(rawJSONDependencies: any) {
                                                    return libs.async.dictionary<api.Depencency>(
                                                        pl.createDictionary<string>(rawJSONDependencies === undefined ? {} : rawJSONDependencies).map((v, k) => {
                                                            return libs.async.rewrite(
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

                                                return libs.async.tuple3(
                                                        resolveDependencies(pkg.dependencies),
                                                        resolveDependencies(pkg.devDependencies),
                                                        pkg.name === undefined
                                                            ? libs.async.value(null)
                                                            : registryCache.getEntry(pkg.name),
                                                            ($): api.Part => {
                                                                return {
                                                                    isPublic: ["api", "lib", "res", "bin"].indexOf(partDir.name) !== -1,
                                                                    packageData: {
                                                                        name: pkg.name === undefined ? null : pkg.name,
                                                                        version: pkg.version === undefined ? null : pkg.version,
                                                                        contentFingerprint: pkg["content-fingerprint"] === undefined ? null : pkg["content-fingerprint"],
                                                                        dependencies: $.first,
                                                                        devDependencies: $.second,
                                                                        remote: $.third,
                                                                    }
                                                                }
                                                            },

                                                )
                                            },
                                            () => {
                                                return libs.async.value({
                                                    isPublic: ["api", "lib", "res", "bin"].indexOf(partDir.name) !== 1,
                                                    packageData: null
                                                })
                                            }
                                        )
                                    }
                                },
                                ($) => {
                                    pr.logError(`!!! ${$[0]}`)
                                    return null
                                },
                            ),
                            (tuple) => {
                                return {
                                    gitClean: tuple.first,
                                    parts: tuple.second
                                }
                            },

                        )

                },
                ($) => {
                    pr.logError(`!!! ${$[0]}`)
                    return null
                }
            ),
            (projects) => {
                return {
                    projects: projects
                }
            }
        )
    }

    return getDataImp
}