
import * as asyncAPI from "pareto-async-api"
import * as asyncLib from "pareto-async-lib"

import { Depencency as D, getData } from "./getData"

const red = "\x1b[31m"
const green = "\x1b[32m"
const yellow = "\x1b[33m"
const cyan = "\x1b[36m"
const reset = "\x1b[0m"


const rootDir = process.argv[2]

if (rootDir === undefined) {
    throw new Error("Missing param")
}

type Overview = {
    projects: asyncAPI.IDictionary<Project>
}

type Project = {
    parts: asyncAPI.IDictionary<Part>
    gitClean: boolean
    isClean: boolean
}

type PartStatus =
    | ["clean", {}]
    | ["missing package", {}]
    | ["invalid package name", {}]
    | ["unpublished", {}]
    | ["fingerprint out of sync", {}]

type Part = {
    isPublic: boolean
    version: null | string
    contentFingerprint: null | string
    status: PartStatus
    dependenciesClean: boolean
    dependencies: asyncAPI.IDictionary<Dependency>
    devDependencies: asyncAPI.IDictionary<Dependency>
}

type DepencencyStatus =
    | ["clean", {}]
    | ["missing remote", {}]
    | ["not at latest version", {}]

type Dependency = {
    version: string
    remoteversion: string | null
    status: DepencencyStatus
}

getData(
    rootDir,
    (res) => {
        const o: Overview = {
            projects: res.projects.map((project, projectName) => {
                const parts: asyncAPI.IDictionary<Part> = project.parts.map<Part>((part, partName) => {
                    if (part.packageData === null) {
                        return {
                            dependencies: asyncLib.createDictionary({}),
                            devDependencies: asyncLib.createDictionary({}),
                            dependenciesClean: true,
                            status: ["missing package", {}],
                            version: null,
                            contentFingerprint: null,
                            isClean: false,
                            isPublic: part.isPublic,
                        }
                    }
                    function processDeps(deps: asyncAPI.IDictionary<D>): asyncAPI.IDictionary<Dependency> {
                        return deps.map<Dependency>((v, k) => {

                            return {
                                version: v.version,
                                remoteversion: v.remote === null ? null : v.remote.latestVersion,
                                status: (() => {
                                    if (v.remote === null) {
                                        return ["missing remote", {}]
                                    } else if (`^${v.remote.latestVersion}` !== v.version) {
                                        return ["not at latest version", {}]
                                    } else {
                                        return ["clean", {}]
                                    }
                                })(),
                            }
                        })
                    }
                    const deps = processDeps(part.packageData.dependencies)
                    const devDeps = processDeps(part.packageData.devDependencies)
                    const status = ((): PartStatus => {
                        if (!part.isPublic) {
                            return ["clean", {}]
                        }
                        if (part.packageData.name !== `${projectName}-${partName}`) {
                            return ["invalid package name", {}]
                        } else if (part.packageData.remote === null) {
                            return ["unpublished", {}]
                        } else if (part.packageData.remote.contentFingerprint === null || part.packageData.remote.contentFingerprint !== part.packageData.contentFingerprint) {
                            return ["fingerprint out of sync", {}]
                        } else {
                            return ["clean", {}]
                        }
                    })()
                    return {
                        dependencies: deps,
                        devDependencies: devDeps,
                        status: status,
                        isPublic: part.isPublic,
                        version: part.packageData.version,
                        contentFingerprint: part.packageData.contentFingerprint,
                        dependenciesClean:
                            deps.toArray().map($ => $.value.status[0] === "clean").reduce((a, b) => a && b, true) &&
                            devDeps.toArray().map($ => $.value.status[0] === "clean").reduce((a, b) => a && b, true)
                    }
                    // if (part.packageData === null) {
                    //     console.log(`\tNO PACKAGE DATA`)
                    // } else {
                    //     console.log(`\t\t>${part.packageData.name} ${part.packageData.version} ${part.packageData.contentFingerprint}`)
                    //     part.packageData.dependencies.forEach((v, k) => {
                    //         console.log(`\t\t${k} -> ${v.version}`)
                    //     })
                    //     part.packageData.devDependencies.forEach((v, k) => {
                    //         console.log(`\t\t${k} -> ${v.version}`)
                    //     })
                    // }
                })
                return {
                    parts: parts,
                    gitClean: project.gitClean,
                    isClean:
                        project.gitClean &&
                        parts.toArray().map($ => { return $.value.status[0] === "clean" && $.value.dependenciesClean }).reduce((previous, current) => previous && current, true)
                }

            })
        }


        o.projects.forEach((project, projectName) => {
            console.log(`${projectName} ${project.gitClean ? "" : `${red}open gitchanges${reset}`}`)
            project.parts.forEach((part, key) => {
                console.log(`\t${key} ${part.version === null ? "" : part.version} ${part.contentFingerprint === null ? "" : part.contentFingerprint} ${part.status[0] === "clean" ? "" : `${red}${part.status[0]}${reset}`}`)
                part.dependencies.forEach((v, k) => {
                    console.log(`\t\t${k} -> ${v.version} ${v.status[0] === "clean" ? "" : `${red}${v.status[0]}${reset}`}`)
                })
                part.devDependencies.forEach((v, k) => {
                    console.log(`\t\t${k}(dev) -> ${v.version} ${v.status[0] === "clean" ? "" : `${red}${v.status[0]}${reset}`}`)
                })
            })
        })


        let i = 0

        console.log(``)
        console.log(`digraph G {`)
        o.projects.forEach((project, projectName) => {
            console.log(`\tsubgraph cluster_${i++} {`)

            project.parts.forEach((part, partName) => {
                if (part.isPublic) {
                    console.log(`\t\t"${projectName}-${partName}" [ color="${part.status[0] !== "clean" || !part.dependenciesClean ? `red` : `green`}"${partName === "api" ? `, style="filled"` : ""} ]`)
                }
            })
            console.log(`\t}`)
        })
        o.projects.forEach((project, projectName) => {

            project.parts.forEach((part, partName) => {
                if (part.isPublic) {
                    part.dependencies.forEach((v, depName) => {
                        if (depName !== "pareto-lang-api" && depName !== "pareto-lang-lib") {
                            console.log(`\t"${projectName}-${partName}" -> "${depName}"`)
                        }
                    })
                    part.devDependencies.forEach((v, depName) => {
                        console.log(`\t"${projectName}-${partName}" -> "${depName}"`)

                    })
                }
            })
        })
        console.log(`}`)

        // const referencedPackages: { [key: string]: null } = {}

        // res.projects.forEach((project, key) => {
        //     project.parts.forEach((part, key) => {
        //         if (part.packageData !== null) {
        //             part.packageData.dependencies.forEach((v, k) => {
        //                 referencedPackages[k] = null
        //             })
        //             part.packageData.devDependencies.forEach((v, k) => {
        //                 referencedPackages[k] = null
        //             })
        //         }
        //     })
        // })

    }
)
