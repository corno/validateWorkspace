interface Array<T> {
    reduce<T> (func: (a: T, b: T) => T, init: T): T
    indexOf: (a: string) => number
}

interface String {
    trimEnd: () => string
    //readonly length: number
    //substring(begin: number, end: number): string
    //substr(begin: number): string
    //charCodeAt(index: number): number
    //split(splitter: string): string[]
    // startsWith(str: string): boolean
    // replace(str: RegExp, rv: string): string
    //toUpperCase(): string
    //padStart():
}