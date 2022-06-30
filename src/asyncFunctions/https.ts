import * as https from "https"
import * as asyncAPI from "pareto-async-api"
import * as asyncLib from "pareto-async-lib"

export function createLeafHTTPSCaller<T>(
    hostname: string,
    path: string,
    onData: (data: string) => void,
    onError: (e: Error) => void,
    onEnd: () => T
): asyncAPI.IAsync<T> {
    return {
        execute: (cb) => {
            const options = {
                hostname: hostname,
                //port: 443,
                path: path,
                method: 'GET'
            }

            const req = https.request(options, res => {
                //console.log(`statusCode: ${res.statusCode}`)


                res.on('data', d => {
                    onData(d)
                })
                res.on('end', () => {
                    cb(onEnd())
                })
            })

            req.on('error', error => {
                onError(error)
            })

            req.end()
        }

    }
}