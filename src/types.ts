export type OutputFormat = "json" | "stdout";
export interface VueScannerOption {
	appDir: string;
	output?: OutputFormat;
	ignore?: string[];
	verbose?: boolean;
	debug?: boolean;
}

export interface PackageGroup {
	packageJsonPath: string;
	files: string[] | null;
	tsConfigPaths?: string[];
}

export type PackageDependency = Record<string, string>;
export interface LibDependency {
	name: string;
	version: string;
}
export interface TraversedTag {
	tag: string;
	row: number; //IVueASTNode.loc.start.line,
}

export interface ChildComponentTag {
	tags: string[];
	total: number;
	source: string;
}

export type ComponentSourceType = "internal" | "external" | null;

export type ImportStatementUsage = {
	lines: Record<string, number[]>;
	dynamic: boolean;
	importPath: string;
};
export interface ImportStatement {
	importedNames: string[];
	source: string;
	destination: string;
	importSourceType: ComponentSourceType;
	sourcePath?: string;
	usage?: ImportStatementUsage;
}

export interface VueProperty {
	name: string;
	type?: string;
	path?: string;
}

export interface ParsedCodeResult {
	componentTags: TraversedTag[];
	importStatements: ImportStatement[] | null;
	deepestNested: number;
	properties?: VueProperty[];
}
export interface FileProperty {
	created: string;
	createdBy: string;
	updatedBy: string;
	lastModified: string;
	dataLastModified: string;
	endOfLines?: number;
	package?: { name: string; version: string }; // TODO: check this key later
}
export interface FileInfo {
	path: string;
	property: FileProperty | null;
}

export interface VueComponent {
	name: string;
	source: string;
	destination: string;
	rows: number[];
	deepestNested: number;
	fileInfo: FileInfo;
	props?: VueProperty[];
}

export interface ComponentProfile {
	name: string;
	type: ComponentSourceType;
	total: number;
	source: FileInfo & { package?: LibDependency };
	deepestNested: number;
	properties?: VueProperty[];
	usageLocations?: VueComponent[];
	groups?: any;
	children?: { total: number; tags: string[]; source: string };
}

export interface VueASTNode {
	type: number;
	ns: number;
	tagType: number;
	tag: string;
	props: any[];
	isSelfClosing: boolean;
	children: VueASTNode[];
	loc: {
		start: { column: number; line: number; offset: number };
		end: { column: number; line: number; offset: number };
	};
}
