
import * as pa from "pareto-lang-api"
import * as pl from "pareto-lang-lib"
import * as api from "pareto-validate-workspace-api"

const red = "\x1b[31m"
const green = "\x1b[32m"
const yellow = "\x1b[33m"
const cyan = "\x1b[36m"
const reset = "\x1b[0m"

type Overview = {
    projects: pa.IReadonlyDictionary<Project>
}

type Project = {
    parts: pa.IReadonlyDictionary<Part>
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
    dependencies: pa.IReadonlyDictionary<Dependency>
    devDependencies: pa.IReadonlyDictionary<Dependency>
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


export function report() {
    return function (
        res: api.Overview,
        console: {
            log: (message: string) => void
        }
    ) {

        const o: Overview = {
            projects: res.projects.map((project, projectName) => {
                const parts: pa.IReadonlyDictionary<Part> = project.parts.map<Part>((part, partName) => {
                    if (part.packageData === null) {
                        return {
                            dependencies: pl.createDictionary({}),
                            devDependencies: pl.createDictionary({}),
                            dependenciesClean: true,
                            status: ["missing package", {}],
                            version: null,
                            contentFingerprint: null,
                            isClean: false,
                            isPublic: part.isPublic,
                        }
                    }
                    function processDeps(deps: pa.IReadonlyDictionary<api.Depencency>): pa.IReadonlyDictionary<Dependency> {
                        return deps.map<Dependency>((v) => {

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
                    //     part.packageData.dependencies.forEach(v) => {
                    //         console.log(`\t\t${k} -> ${v.version}`)
                    //     })
                    //     part.packageData.devDependencies.forEach((v) => {
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


        o.projects.toArray().forEach((project) => {
            console.log(`${project.key} ${project.value.gitClean ? "" : `${red}open gitchanges${reset}`}`)
            project.value.parts.toArray().forEach((part) => {
                console.log(`\t${part.key} ${part.value.version === null ? "" : part.value.version} ${part.value.contentFingerprint === null ? "" : part.value.contentFingerprint} ${part.value.status[0] === "clean" ? "" : `${red}${part.value.status[0]}${reset}`}`)
                part.value.dependencies.toArray().forEach((v) => {
                    console.log(`\t\t${v.key} -> ${v.value.version} ${v.value.status[0] === "clean" ? "" : `${red}${v.value.status[0]}${reset}`}`)
                })
                part.value.devDependencies.toArray().forEach((v) => {
                    console.log(`\t\t${v.key}(dev) -> ${v.value.version} ${v.value.status[0] === "clean" ? "" : `${red}${v.value.status[0]}${reset}`}`)
                })
            })
        })


        let i = 0

        console.log(``)
        console.log(`digraph G {`)
        console.log(`\trankdir="LR"`)
        
        o.projects.toArray().forEach((project) => {
            console.log(`\tsubgraph cluster_${i++} {`)

            project.value.parts.toArray().forEach((part) => {
                if (part.value.isPublic) {
                    console.log(`\t\t"${project.key}-${part.key}" [ color="${part.value.status[0] !== "clean" || !part.value.dependenciesClean ? `red` : `green`}"${part.key === "api" ? `, style="filled"` : ""} ]`)
                }
            })
            console.log(`\t}`)
        })
        o.projects.toArray().forEach((project) => {

            project.value.parts.toArray().forEach((part) => {
                if (part.value.isPublic) {
                    part.value.dependencies.toArray().forEach((v) => {
                        if (v.key !== "pareto-lang-api" && v.key !== "pareto-lang-lib") {
                            console.log(`\t"${project.key}-${part.key}" -> "${v.key}"`)
                        }
                    })
                    part.value.devDependencies.toArray().forEach((v) => {
                        console.log(`\t"${project.key}-${part.key}" -> "${v.key}"`)

                    })
                }
            })
        })
        console.log(`}`)

        // const referencedPackages: { [key: string]: null } = {}

        // res.projects.forEach((project) => {
        //     project.parts.forEach((part) => {
        //         if (part.packageData !== null) {
        //             part.packageData.dependencies.forEach((v) => {
        //                 referencedPackages[k] = null
        //             })
        //             part.packageData.devDependencies.forEach((v) => {
        //                 referencedPackages[k] = null
        //             })
        //         }
        //     })
        // })
    }
}