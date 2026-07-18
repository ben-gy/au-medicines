// The pipeline is plain ESM JavaScript — it runs under bare node in CI with no
// build step — so these declarations exist purely so the test suite can import
// its pure helpers under `tsc`.
export declare function parseCsvLine(line: string): string[];
export declare function slugify(name: string): string;
export declare function monthIndex(months: string[], ym: string): number;
export declare function monthLabel(ym: string): string;
